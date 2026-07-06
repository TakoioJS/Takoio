/**
 * Config AI Providers — serialization/deserialization of AI provider config.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 */

import type { AIProviderConfig, AIProviderFormat } from './config-schema'

const VALID_AI_FORMATS: AIProviderFormat[] = ['openai', 'anthropic', 'gemini']

function normalizeFormat (format: unknown): AIProviderFormat {
  if (format === 'google') return 'gemini'
  if (VALID_AI_FORMATS.includes(format as AIProviderFormat)) return format as AIProviderFormat
  return 'openai'
}

/** 将 AI Provider 配置序列化为 JSON 字符串（存储用） */
export function serializeAIProviders (providers: AIProviderConfig[]): string {
  return JSON.stringify(providers)
}

/** 将 AI Provider 配置反序列化/归一化为数组，并校验 format 字段 */
export function deserializeAIProviders (input: string | unknown): AIProviderConfig[] {
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is AIProviderConfig =>
      p && typeof p.name === 'string' && typeof p.endpoint === 'string'
    ).map(p => ({
      ...p,
      format: normalizeFormat(p.format),
    }))
  } catch {
    return []
  }
}
