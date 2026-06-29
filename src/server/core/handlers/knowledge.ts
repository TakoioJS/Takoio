/**
 * Knowledge base handler — RAG pipeline for article indexing and AI chat
 *
 * Features:
 * - Index articles: chunk text → generate embeddings → store in Redis
 * - Delete article indexes
 * - RAG chat: question → embedding search → context injection → LLM answer
 * - Semantic search: question → embedding search → return relevant chunks
 */

import { generateText, embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getConfig } from '../config'
import { storeEmbedding, searchSimilar, deleteEmbeddings, getVectorStats } from '../store/vector'
import { isRedisAvailable } from '../store/redis'

type AiFormat = 'openai' | 'anthropic' | 'gemini'

// ========== Helpers ==========

function createModelInstance (format: AiFormat, endpoint: string, key: string, model: string) {
  switch (format) {
    case 'anthropic':
      return createAnthropic({ apiKey: key })(model)
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey: key })(model)
    case 'openai':
    default: {
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.replace(/\/v1$/, '')
      return createOpenAI({ baseURL: baseUrl, apiKey: key })(model)
    }
  }
}

/** Split text into overlapping chunks of ~512 tokens (≈2000 chars with overlap) */
function chunkText (text: string, chunkSize = 1800, overlap = 200): string[] {
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + chunkSize
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('。', end)
      const lastNewline = text.lastIndexOf('\n', end)
      const breakPoint = Math.max(lastPeriod, lastNewline)
      if (breakPoint > start + chunkSize * 0.5) end = breakPoint + 1
    }
    chunks.push(text.slice(start, end))
    start = end - overlap
  }
  return chunks
}

/** Resolve an AI provider by name from config */
async function resolveProvider (providerName?: string) {
  const cfg = await getConfig()
  let providers: any[] = []
  try {
    const raw = cfg.AI_PROVIDERS || '[]'
    providers = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []
  } catch { providers = [] }

  const name = providerName || providers[0]?.name
  return providers.find((p: any) => p.name === name) || null
}

/** Generate embedding for a text string */
async function generateEmbedding (text: string, provider: any, modelName: string): Promise<number[]> {
  const model = createOpenAI({
    baseURL: provider.endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/v1$/, ''),
    apiKey: provider.key,
  }).embedding(modelName)

  const { embedding: emb } = await embed({ model, value: text })
  return emb
}

const RAG_SYSTEM_PROMPT = `你是一个知识库助手。根据以下参考内容回答用户的问题。

规则：
1. 仅基于提供的参考内容回答，不要编造信息
2. 如果参考内容中没有相关信息，请如实说明
3. 回答要简洁明了，使用中文
4. 引用来源时要标注参考的文档标题

参考内容：
{context}`

// ========== Public API ==========

export async function handleIndexArticle (data: {
  content: string
  url: string
  title?: string
  provider?: string
  embeddingModel?: string
}): Promise<{ success: boolean; message: string; chunks: number }> {
  if (!data.content || !data.url) {
    return { success: false, message: '缺少必要参数：content, url', chunks: 0 }
  }

  const redisOk = await isRedisAvailable()
  if (!redisOk) {
    return { success: false, message: 'Redis 不可用，请检查 REDIS_URL 配置', chunks: 0 }
  }

  const provider = await resolveProvider(data.provider)
  if (!provider) {
    return { success: false, message: '未找到可用的 AI 提供商', chunks: 0 }
  }

  const cfg = await getConfig()
  const embeddingModel = data.embeddingModel || cfg.AI_EMBEDDING_MODEL || 'text-embedding-3-small'
  const title = data.title || data.url

  try {
    // Delete existing embeddings for this URL
    await deleteEmbeddings(data.url)

    // Chunk the text
    const chunks = chunkText(data.content)
    let storedCount = 0

    for (let i = 0; i < chunks.length; i++) {
      try {
        const vector = await generateEmbedding(chunks[i], provider, embeddingModel)
        const ok = await storeEmbedding(data.url, title, i, chunks[i], vector)
        if (ok) storedCount++
      } catch (e: any) {
        console.warn(`[knowledge] Failed to embed chunk ${i}:`, e.message)
      }
    }

    return {
      success: storedCount > 0,
      message: storedCount > 0 ? `成功索引 ${storedCount}/${chunks.length} 个文档块` : '所有文档块索引失败',
      chunks: storedCount,
    }
  } catch (e: any) {
    return { success: false, message: `索引失败: ${e.message}`, chunks: 0 }
  }
}

export async function handleDeleteArticle (url: string): Promise<{ success: boolean; message: string; deleted: number }> {
  const count = await deleteEmbeddings(url)
  return {
    success: count > 0,
    message: count > 0 ? `已删除 ${count} 个文档块` : '未找到该 URL 的索引',
    deleted: count,
  }
}

export async function handleKnowledgeChat (data: {
  question: string
  url?: string
  provider?: string
  model?: string
}): Promise<{ success: boolean; message: string; answer: string; sources: string[] }> {
  if (!data.question) {
    return { success: false, message: '缺少问题', answer: '', sources: [] }
  }

  const cfg = await getConfig()

  // Resolve embedding provider for question embedding
  const embProvider = await resolveProvider(cfg.AI_EMBEDDING_PROVIDER || undefined)
  if (!embProvider) {
    return { success: false, message: '未找到 Embedding 提供商', answer: '', sources: [] }
  }

  const embeddingModel = cfg.AI_EMBEDDING_MODEL || 'text-embedding-3-small'

  try {
    // Generate question embedding
    const questionVector = await generateEmbedding(data.question, embProvider, embeddingModel)

    // Search for similar chunks
    const results = await searchSimilar(questionVector, 5, data.url)

    if (results.length === 0) {
      return {
        success: true,
        message: '未找到相关文档',
        answer: '抱歉，知识库中没有找到与您的问题相关的内容。',
        sources: [],
      }
    }

    // Build context from search results
    const context = results.map(r => `[${r.title}] ${r.text}`).join('\n\n---\n\n')
    const sources = [...new Set(results.map(r => r.title || r.url).filter(Boolean))]

    // Resolve chat LLM provider
    const chatProvider = await resolveProvider(data.provider || cfg.AI_CHAT_PROVIDER || undefined)
    if (!chatProvider) {
      return { success: false, message: '未找到对话 LLM 提供商', answer: '', sources }
    }

    const chatModel = data.model || cfg.AI_CHAT_MODEL || chatProvider.models?.[0] || 'gpt-4o-mini'
    const modelInstance = createModelInstance(
      chatProvider.format as AiFormat,
      chatProvider.endpoint,
      chatProvider.key,
      chatModel,
    )

    const systemPrompt = RAG_SYSTEM_PROMPT.replace('{context}', context)

    const { text: answer } = await generateText({
      model: modelInstance,
      system: systemPrompt,
      prompt: data.question,
      temperature: 0.4,
      maxTokens: 2048,
    })

    return { success: true, message: '回答成功', answer, sources }
  } catch (e: any) {
    return { success: false, message: `对话失败: ${e.message}`, answer: '', sources: [] }
  }
}

export async function handleKnowledgeSearch (data: {
  query: string
  url?: string
  limit?: number
  provider?: string
  embeddingModel?: string
}): Promise<{ success: boolean; message: string; results: Array<{ url: string; title: string; text: string; score: number }> }> {
  if (!data.query) {
    return { success: false, message: '缺少搜索关键词', results: [] }
  }

  const cfg = await getConfig()
  const provider = await resolveProvider(data.provider || cfg.AI_EMBEDDING_PROVIDER || undefined)
  if (!provider) {
    return { success: false, message: '未找到 Embedding 提供商', results: [] }
  }

  const embeddingModel = data.embeddingModel || cfg.AI_EMBEDDING_MODEL || 'text-embedding-3-small'

  try {
    const vector = await generateEmbedding(data.query, provider, embeddingModel)
    const results = await searchSimilar(vector, data.limit || 10, data.url)
    return { success: true, message: `找到 ${results.length} 个相关结果`, results }
  } catch (e: any) {
    return { success: false, message: `搜索失败: ${e.message}`, results: [] }
  }
}

export async function handleKnowledgeStatus (): Promise<{
  success: boolean
  redisAvailable: boolean
  stats: { totalDocs: number; totalChunks: number; indexedUrls: string[] }
}> {
  const redisAvailable = await isRedisAvailable()
  const stats = redisAvailable ? await getVectorStats() : { totalDocs: 0, totalChunks: 0, indexedUrls: [] }
  return { success: true, redisAvailable, stats }
}
