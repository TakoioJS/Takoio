/**
 * AI 评论审核模块
 *
 * 双层审核架构：
 * 1. 本地规则引擎（关键词 + 正则）— 快速预过滤
 * 2. LLM API 审核（AI SDK）— 深度智能分析
 *
 * 配置项（管理面板 → 安全设置）：
 *   AI_MODERATION_ENABLED   - 启用 LLM 审核
 *   AI_MODERATION_ENDPOINT  - API 地址
 *   AI_MODERATION_KEY       - API Key
 *   AI_MODERATION_MODEL     - 模型名
 *   AI_MODERATION_PROMPT    - 自定义提示词
 */

import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod/v3'
import { logger } from './utils/logger'

// ========== Schema ==========

const ModerationLLMSchema = z.object({
  spam: z.boolean(),
  confidence: z.number().min(0).max(100),
  reason: z.string(),
})
type ModerationLLMResult = z.infer<typeof ModerationLLMSchema>

export interface ModerationResult {
  passed: boolean
  spam: boolean
  score: number
  reasons: string[]
  source: 'keyword' | 'llm' | 'none'
}

export type AuditMode = 'pass' | 'audit' | 'reject'

// ========== 第一层：本地规则引擎 ==========

function keywordCheck (text: string, blockedKeywords: string[], nick?: string): ModerationResult | null {
  const reasons: string[] = []
  let score = 0

  if (nick && blockedKeywords.some(kw => nick.includes(kw))) {
    return { passed: false, spam: true, score: 90, reasons: ['昵称包含敏感词'], source: 'keyword' }
  }

  let hits = 0
  for (const kw of blockedKeywords) {
    if (text.includes(kw)) { hits++; if (hits === 1) reasons.push('包含敏感词') }
  }
  score += hits * 30

  const SPAM_PATTERNS: RegExp[] = [
    /([\u4e00-\u9fa5])\1{4,}/,
    /(.)\1{12,}/,
    /https?:\/\/[^\s]{60,}/
  ]

  for (const p of SPAM_PATTERNS) {
    if (p.test(text)) { score += 25; reasons.push('匹配垃圾模式'); break }
  }

  const links = (text.match(/https?:\/\//g) || []).length
  if (links > 3) { score += 20; reasons.push('过多外链') }

  score = Math.min(score, 100)
  if (score >= 60) return { passed: false, spam: true, score, reasons, source: 'keyword' }

  return null
}

// ========== 第二层：LLM API 审核 ==========

const DEFAULT_LLM_PROMPT = `你是一个内容审核助手。分析用户评论，判断是否为垃圾/广告/违规内容。

返回严格的 JSON（不要包含 markdown 代码块标记）：
{
  "spam": true/false,
  "confidence": 0-100,
  "reason": "简短原因"
}

判断标准：
- 纯广告/推广 → spam=true, confidence>=80
- 人身攻击/辱骂 → spam=true
- 正常讨论/提问 → spam=false
- 简单的"谢谢""学到了" → spam=false
- 带外链的推荐 → 需谨慎判断`

type AiFormat = 'openai' | 'anthropic' | 'gemini'

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

async function llmCheck (
  text: string,
  format: AiFormat,
  endpoint: string,
  key: string,
  model: string,
  prompt: string
): Promise<ModerationResult> {
  const modelInstance = createModelInstance(format, endpoint, key, model)

  const { object } = await generateObject({
    model: modelInstance,
    system: prompt,
    prompt: text,
    schema: ModerationLLMSchema,
    temperature: 0.1,
  })

  return {
    passed: !object.spam,
    spam: object.spam,
    score: object.confidence || 0,
    reasons: object.spam ? [object.reason || 'AI 判定为垃圾'] : [],
    source: 'llm',
  }
}

// ========== 主入口 ==========

interface ModerateCommentConfig {
  enabled?: boolean
  endpoint?: string
  key?: string
  model?: string
  prompt?: string
  format?: string
  blockedKeywords?: string
}

export async function moderateComment (
  text: string,
  nick?: string,
  link?: string,
  config?: ModerateCommentConfig
): Promise<ModerationResult> {
  if (!text || text.trim().length < 2) {
    return { passed: false, spam: false, score: 100, reasons: ['内容过短'], source: 'none' }
  }
  if (text.length > 5000) {
    return { passed: false, spam: false, score: 100, reasons: ['内容过长'], source: 'none' }
  }

  // 解析关键词列表
  const keywords = (config?.blockedKeywords || '')
    .split(/[,，\n]/)
    .map(k => k.trim())
    .filter(k => k.length > 0)

  // 第一层：本地规则
  if (keywords.length > 0) {
    const keywordResult = keywordCheck(text, keywords, nick)
    if (keywordResult) return keywordResult
  }

  // 第二层：LLM 审核
  if (config?.enabled && config?.key && config?.endpoint) {
    try {
      return await llmCheck(
        text,
        (config.format as AiFormat) || 'openai',
        config.endpoint,
        config.key,
        config.model || 'gpt-4o-mini',
        config.prompt || DEFAULT_LLM_PROMPT
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn({ error: message }, 'LLM moderation call failed, falling back to pass')
    }
  }

  return { passed: true, spam: false, score: 0, reasons: [], source: 'none' }
}

export function getAuditAction (result: ModerationResult, mode: AuditMode): 'approved' | 'pending' | 'rejected' {
  if (result.spam) return 'rejected'
  if (mode === 'pass') return 'approved'
  if (!result.passed) return 'pending'
  return 'approved'
}
