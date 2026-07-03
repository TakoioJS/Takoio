/**
 * Config AI Providers — serialization/deserialization of AI provider config.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 */

import type { AIProviderConfig } from './config-schema'

/** 将 AI Provider 配置序列化为 JSON 字符串（存储用） */
export function serializeAIProviders (providers: AIProviderConfig[]): string {
  return JSON.stringify(providers)
}

/** 将 JSON 字符串反序列化为 AI Provider 配置数组 */
export function deserializeAIProviders (json: string): AIProviderConfig[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is AIProviderConfig =>
      p && typeof p.name === 'string' && typeof p.endpoint === 'string'
    )
  } catch {
    return []
  }
}
