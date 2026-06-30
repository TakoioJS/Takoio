/**
 * AI 文章摘要生成
 *
 * 使用已配置的 AI_PROVIDERS 中的 LLM，通过 Vercel AI SDK 的
 * generateText() 生成文章摘要和关键词。
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getConfig } from '../config'
import { isRedisAvailable } from '../store/redis'
import { isDev } from '../utils/env'

type AiFormat = 'openai' | 'anthropic' | 'gemini'

const SUMMARY_SYSTEM_PROMPT = `你是一个文章摘要生成助手。请根据用户提供的文章内容，生成一段简洁的中文摘要（100-200字），并提取3-5个核心关键词。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "summary": "文章摘要内容",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

要求：
- 摘要应概括文章的核心观点和关键信息
- 关键词应反映文章主题，便于检索
- 使用中文输出`

function createModelInstance (format: AiFormat, endpoint: string, key: string, model: string) {
  switch (format) {
    case 'anthropic': {
      // Anthropic SDK baseURL 默认含 /v1，请求会追加 /messages，故 baseURL 需保留 /v1
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v\d/.test(baseUrl)) baseUrl += '/v1'
      return createAnthropic({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'gemini': {
      // Gemini SDK baseURL 默认含 /v1beta，请求会追加 /models/...，故 baseURL 需保留 /v1beta
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v1beta/.test(baseUrl)) baseUrl += '/v1beta'
      return createGoogleGenerativeAI({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'openai':
    default: {
      // OpenAI SDK baseURL 默认含 /v1，url = `${baseURL}${path}`，SDK 不会自动补 /v1，故 baseURL 须保留版本段。
      // 注意：@ai-sdk/openai v4 直接调用 provider（如 createOpenAI({...})(model)）默认走 Responses API（/responses），
      // 多数第三方 OpenAI 兼容端点（阶跃、DeepSeek 等）未实现 /responses，需显式用 .chat(model) 走 Chat Completions。
      const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      return createOpenAI({ baseURL: baseUrl, apiKey: key }).chat(model)
    }
  }
}

interface ArticleSummaryResult {
  summary: string
  keywords: string[]
}

export async function handleArticleSummary (data: {
  content: string
  url?: string
  title?: string
  provider?: string
  model?: string
}): Promise<ArticleSummaryResult & { success: boolean; message: string }> {
  const cfg = await getConfig()

  if (!data.content || data.content.trim().length < 10) {
    return { success: false, message: '文章内容过短，无法生成摘要', summary: '', keywords: [] }
  }

  // AI 摘要功能要求 Redis 可用（开发环境跳过检查；AI 审核和 NSFW 检测豁免）
  if (!isDev()) {
    const redisOk = await isRedisAvailable()
    if (!redisOk) {
      return { success: false, message: 'Redis 不可用，AI 摘要功能需要 Redis。请配置 REDIS_URL 环境变量', summary: '', keywords: [] }
    }
  }

  // Resolve AI provider
  let providers: any[] = []
  try {
    const raw = cfg.AI_PROVIDERS || '[]'
    providers = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []
  } catch { providers = [] }

  // Try specified provider first, then config default, then first available
  const providerName = data.provider || cfg.AI_SUMMARY_PROVIDER || (providers[0]?.name as string | undefined)
  const provider = providers.find((p: any) => p.name === providerName)

  if (!provider || !provider.key || !provider.endpoint) {
    return { success: false, message: '未找到可用的 AI 提供商，请先在 AI 页面配置', summary: '', keywords: [] }
  }

  const modelName = data.model || cfg.AI_SUMMARY_MODEL || provider.models?.[0] || 'gpt-4o-mini'

  try {
    const modelInstance = createModelInstance(
      provider.format as AiFormat,
      provider.endpoint,
      provider.key,
      modelName,
    )

    const prompt = data.title
      ? `文章标题：${data.title}\n\n文章内容：\n${data.content}`
      : data.content

    const { text } = await generateText({
      model: modelInstance,
      system: SUMMARY_SYSTEM_PROMPT,
      prompt,
      temperature: 0.3,
      maxTokens: 1024,
    })

    // Parse JSON from response
    let parsed: ArticleSummaryResult
    try {
      // Strip markdown code block markers if present
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parse fails, use the text as summary
      parsed = { summary: text, keywords: [] }
    }

    return {
      success: true,
      message: '摘要生成成功',
      summary: parsed.summary || text,
      keywords: parsed.keywords || [],
    }
  } catch (e: any) {
    return { success: false, message: `摘要生成失败: ${e.message}`, summary: '', keywords: [] }
  }
}
