/**
 * AI 评论审核模块
 *
 * 双层审核架构：
 * 1. 本地规则引擎（关键词 + 正则）— 快速预过滤
 * 2. LLM API 审核（OpenAI 兼容）— 深度智能分析
 *
 * 配置项（管理面板 → 安全设置）：
 *   AI_MODERATION_ENABLED   - 启用 LLM 审核
 *   AI_MODERATION_ENDPOINT  - API 地址（https://api.openai.com/v1/chat/completions）
 *   AI_MODERATION_KEY       - API Key
 *   AI_MODERATION_MODEL     - 模型名（gpt-3.5-turbo / gpt-4o-mini 等）
 *   AI_MODERATION_PROMPT    - 自定义提示词
 */

import { logger } from './utils/logger'

export interface ModerationResult {
  passed: boolean        // 是否通过审核
  spam: boolean          // 是否为垃圾
  score: number          // 0-100，越高越可疑
  reasons: string[]      // 拒绝原因
  source: 'keyword' | 'llm' | 'none'  // 判定来源
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

interface LLMResponse {
  spam: boolean
  confidence: number
  reason: string
}

async function llmCheck (
  text: string,
  endpoint: string,
  key: string,
  model: string,
  prompt: string,
  format: string
): Promise<ModerationResult> {
  const isAnthropic = format === 'anthropic'
  const isGemini = format === 'gemini'
  // openai / deepseek / vercel / cloudflare / custom 都用 OpenAI 兼容格式

  let res: Response

  if (isGemini) {
    // Google Gemini API format
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text }] }
        ],
        systemInstruction: { parts: [{ text: prompt }] },
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
      }),
      signal: AbortSignal.timeout(8000)
    })
  } else if (isAnthropic) {
    // Anthropic API format
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: prompt,
        messages: [{ role: 'user', content: text }],
        max_tokens: 200,
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(8000)
    })
  } else {
    // OpenAI-compatible format
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(8000)
    })
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`LLM API ${res.status}: ${err.slice(0, 200)}`)
  }

  const json: any = await res.json()

  // 解析不同格式的响应
  let raw: string
  if (isGemini) {
    raw = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } else if (isAnthropic) {
    raw = json.content?.[0]?.text || ''
  } else {
    raw = json.choices?.[0]?.message?.content || ''
  }

  // 解析 JSON 响应
  let parsed: LLMResponse = { spam: false, confidence: 0, reason: '' }
  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    // JSON 解析失败，用文本模式兜底
    const lower = raw.toLowerCase()
    parsed = {
      spam: lower.includes('spam') || lower.includes('广告') || lower.includes('违规'),
      confidence: 50,
      reason: raw.slice(0, 200)
    }
  }

  return {
    passed: !parsed.spam,
    spam: parsed.spam,
    score: parsed.confidence || 0,
    reasons: parsed.spam ? [parsed.reason || 'AI 判定为垃圾'] : [],
    source: 'llm'
  }
}

// ========== 主入口 ==========

export async function moderateComment (
  text: string,
  nick?: string,
  link?: string,
  config?: {
    enabled?: boolean
    endpoint?: string
    key?: string
    model?: string
    prompt?: string
    format?: string
    blockedKeywords?: string
  }
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
        config.endpoint,
        config.key,
        config.model || 'gpt-4o-mini',
        config.prompt || DEFAULT_LLM_PROMPT,
        config.format || 'openai'
      )
    } catch (e: any) {
      logger.warn({ error: e.message }, 'LLM moderation call failed, falling back to pass')
      // LLM 失败时降级通过（不阻塞正常评论）
    }
  }

  return { passed: true, spam: false, score: 0, reasons: [], source: 'none' }
}

export function getAuditAction (result: ModerationResult, mode: AuditMode): 'approved' | 'pending' | 'rejected' {
  if (result.spam) return 'rejected'
  if (mode === 'pass') return 'approved'
  if (result.passed) return 'approved'
  return 'pending'
}
