/**
 * Config Schema — TakoioConfig interface, defaults, allowed keys, Zod validation.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 * 设计原则：config-meta.ts 的 CONFIG_META 是配置的唯一真实来源；
 * ALLOWED_CONFIG_KEYS 从 DEFAULT_CONFIG 的 keys 自动生成。
 */

import { DEFAULT_CONFIG_MAP } from './config-meta'
import { z } from 'zod/v3'
import { AppError } from './errors'

// ========== AI Provider Config (Structured) ==========

/** AI 提供商接口格式，与 @ai-sdk/* 提供商标识保持一致 */
export type AIProviderFormat = 'openai' | 'anthropic' | 'gemini'

export interface AIProviderConfig {
  name: string
  endpoint: string
  key: string
  format: AIProviderFormat
  models: string[]
}

// ========== Config Interface ==========

export interface TakoioConfig {
  TYPE?: string
  SITE_NAME: string
  SITE_URL?: string
  MASTER?: string
  MASTER_NAME: string
  MASTER_LABEL?: string
  MASTER_LABEL_COLOR?: string
  GLOBAL_COLOR: string
  PAGE_SIZE: number
  COMMENT_SORT: 'newest' | 'oldest' | 'hottest'
  COMMENT_LENGTH_MAX: number
  REQUIRED_FIELDS: string[]
  COMMENT_NICK_REQUIRED: boolean
  GRAVATAR_URL: string
  GRAVATAR_URL_CUSTOM?: string
  GRAVATAR_DEFAULT: string
  ENABLE_VISITOR_COUNTER: boolean
  COMMENT_PAGINATION_MODE: 'pagination' | 'readmore'
  COMMENT_RATE_LIMIT: number
  AUDIT_MODE: boolean
  IP_REGION_ENABLED: boolean
  IP_PROXY_HEADER: string
  TRUSTED_PROXIES: string
  SHOW_IP_REGION: boolean | string
  SHOW_UA_INFO: boolean
  ENABLE_ARTICLE_REACTION?: boolean
  ENABLE_COMMENT_REACTION?: boolean
  ENABLE_LINK_INPUT: boolean
  COMMENT_LINK_REQUIRED: boolean
  ENABLE_ADMIN_KEYWORD: boolean
  ADMIN_KEYWORD: string
  ENABLE_CODE_HIGHLIGHT: boolean
  CODE_HIGHLIGHT_THEME: string
  CODE_SHOW_LANGUAGE: boolean
  CODE_SHOW_COPY: boolean
  ENABLE_CAPTCHA: boolean
  ENABLE_IMAGE_UPLOAD: boolean
  CAPTCHA_PROVIDER: 'turnstile' | 'recaptcha' | 'hcaptcha' | 'geetest'
  CAPTCHA_TYPE: string
  CAPTCHA_SECRET_KEY: string
  CAPTCHA_SITE_KEY: string
  IMAGE_HOSTING_PROVIDER: string
  IMAGE_HOSTING_ENDPOINT: string
  IMAGE_HOSTING_TOKEN: string
  IMAGE_HOSTING_BUCKET: string
  IMAGE_HOSTING_REGION: string
  IMAGE_HOSTING_ACCESS_KEY: string
  IMAGE_HOSTING_SECRET_KEY: string
  IMAGE_HOSTING_CDN_DOMAIN: string
  ENABLE_NSFW_DETECTION: boolean
  NSFW_SERVICE: string
  NSFW_ENDPOINT: string
  NSFW_API_KEY: string
  NSFW_THRESHOLD: number
  BLOCKED_KEYWORDS: string
  SMTP_HOST: string
  SMTP_PORT: number
  SMTP_USER: string
  SMTP_PASS: string
  SMTP_FROM: string
  SMTP_TO: string
  SMTP_TLS: boolean
  ENABLE_MAIL_NOTIFICATION: boolean
  MAIL_NOTIFY_ENABLED?: boolean
  SENDER_EMAIL: string
  SENDER_NAME: string
  MAIL_SUBJECT: string
  MAIL_TEMPLATE: string
  MAIL_SUBJECT_ADMIN: string
  MAIL_TEMPLATE_ADMIN: string
  AUTO_AUDIT_METHOD: string
  AUTO_AUDIT_AI_PROVIDER: string
  AUTO_AUDIT_AI_MODEL: string
  AUTO_AUDIT_AI_PROMPT: string
  AI_PROVIDERS: string
  AI_SUMMARY_ENABLED: boolean
  AI_SUMMARY_PROVIDER: string
  AI_SUMMARY_MODEL: string
  ENABLE_SUMMARY?: boolean
  AKISMET_KEY?: string
  ENABLE_ANTI_SPAM?: boolean
  CORS_ORIGINS: string
  CUSTOM_CSS?: string
  CDN_PREFIX?: string
  COMMENT_BG_IMAGE?: string
  COMMENT_FEATURES?: string
  PUSHOO_CHANNELS: string
  // Social Auth
  SOCIAL_AUTH_EMAIL_ENABLED: boolean
  SOCIAL_AUTH_GITHUB_ENABLED: boolean
  SOCIAL_AUTH_GITHUB_CLIENT_ID: string
  SOCIAL_AUTH_GITHUB_CLIENT_SECRET: string
  SOCIAL_AUTH_GOOGLE_ENABLED: boolean
  SOCIAL_AUTH_GOOGLE_CLIENT_ID: string
  SOCIAL_AUTH_GOOGLE_CLIENT_SECRET: string
}

// ========== Default Config (auto-generated from CONFIG_META) ==========

export const DEFAULT_CONFIG: TakoioConfig = DEFAULT_CONFIG_MAP as unknown as TakoioConfig

// ========== Auto-Generated Allowed Keys ==========

/**
 * 从 DEFAULT_CONFIG 的 keys 自动生成允许修改的配置键白名单。
 * 确保新增配置项时自动包含，无需手动同步。
 */
export const ALLOWED_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof TakoioConfig)[]

// ========== Config Validation (Zod) ==========

const ConfigValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])

function buildKeySchema (key: string): z.ZodTypeAny {
  const defVal = DEFAULT_CONFIG[key as keyof TakoioConfig]
  if (defVal === undefined) return ConfigValueSchema
  if (typeof defVal === 'number') return z.number()
  if (typeof defVal === 'boolean') return z.boolean()
  if (Array.isArray(defVal)) return z.array(z.string())
  return z.string()
}

/**
 * Validate a single config key-value pair.
 * Returns the parsed value (converted to correct type) or throws.
 */
export function validateConfigValue (key: string, value: unknown): unknown {
  if (!ALLOWED_CONFIG_KEYS.includes(key as keyof TakoioConfig)) {
    throw new AppError('INVALID_CONFIG', `不允许的配置键: ${key}`, 400)
  }
  const schema = buildKeySchema(key)
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError('INVALID_CONFIG', `配置 ${key} 的值类型不正确`, 400)
  }
  return result.data
}

/**
 * Validate a batch of config key-value pairs.
 * Returns { valid: Record<string, unknown>, skipped: Record<string, string> }
 */
export function validateConfigBatch (
  updates: Record<string, unknown>
): { valid: Record<string, unknown>; skipped: Record<string, string> } {
  const valid: Record<string, unknown> = {}
  const skipped: Record<string, string> = {}
  for (const [key, value] of Object.entries(updates)) {
    // Skip null/undefined — admin panel sends unset keys as undefined
    if (value === null || value === undefined) continue
    if (!ALLOWED_CONFIG_KEYS.includes(key as keyof TakoioConfig)) {
      skipped[key] = `不允许的配置键: ${key}`
      continue
    }
    try {
      valid[key] = validateConfigValue(key, value)
    } catch {
      skipped[key] = '值类型不正确'
    }
  }
  return { valid, skipped }
}

// ========== AI Provider Serialization ==========

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
