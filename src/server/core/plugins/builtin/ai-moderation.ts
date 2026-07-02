/**
 * Built-in Plugin: AI-powered Moderation
 *
 * Third-layer content analysis — sends comment to an LLM API
 * for deep spam/ad detection.
 * Uses preSubmit hook.
 */

import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod/v3'
import type { TakoioPlugin, HookContext, HookResult } from '../types'

const ModerationLLMSchema = z.object({
  spam: z.boolean(),
  confidence: z.number().min(0).max(100),
  reason: z.string(),
})

const DEFAULT_PROMPT = `你是一个内容审核助手。分析用户评论，判断是否为垃圾/广告/违规内容。

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

function createModel (format: string, endpoint: string, key: string, model: string) {
  switch (format) {
    case 'anthropic': {
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v\d/.test(baseUrl)) baseUrl += '/v1'
      return createAnthropic({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'gemini': {
      let baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      if (!/\/v1beta/.test(baseUrl)) baseUrl += '/v1beta'
      return createGoogleGenerativeAI({ baseURL: baseUrl, apiKey: key })(model)
    }
    case 'openai':
    default: {
      const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
      return createOpenAI({ baseURL: baseUrl, apiKey: key }).chat(model)
    }
  }
}

export const aiModerationPlugin: TakoioPlugin = {
  name: 'moderation-ai',
  version: '1.0.0',

  async preSubmit (comment, ctx: HookContext): Promise<HookResult> {
    const cfg = ctx.config as any

    // Check if AI moderation is enabled
    if (cfg?.moderation?.autoAuditMethod !== 'ai') return { action: 'continue' }

    let endpoint = ''
    let key = ''
    let format = 'openai'

    try {
      const providers = JSON.parse(cfg?.ai?.providers || '[]')
      const provider = providers.find((p: any) => p.id === cfg?.moderation?.autoAuditAiProvider)
      if (provider) {
        endpoint = provider.endpoint || ''
        key = provider.key || ''
        format = provider.format || 'openai'
      }
    } catch { /* ignore parse errors */ }

    if (!key || !endpoint) return { action: 'continue' }

    const model = cfg?.moderation?.autoAuditAiModel || 'gpt-4o-mini'
    const prompt = cfg?.moderation?.autoAuditAiPrompt || DEFAULT_PROMPT
    const text = comment.comment || ''

    try {
      const modelInstance = createModel(format, endpoint, key, model)
      const { object } = await generateObject({
        model: modelInstance,
        system: prompt,
        prompt: text,
        schema: ModerationLLMSchema,
        temperature: 0.1,
      })

      if (object.spam) {
        return { action: 'reject', reason: object.reason || 'AI 判定为垃圾内容' }
      }
    } catch {
      // LLM call failed — let it pass (don't block real users)
    }

    return { action: 'continue' }
  },
}
