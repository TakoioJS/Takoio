/**
 * Config management — defaults, retrieval, caching, masking.
 *
 * 设计原则：
 * 1. 单一来源：config-meta.ts 的 CONFIG_META 是配置的唯一真实来源
 * 2. 自动同步：ALLOWED_CONFIG_KEYS / HIDDEN_KEYS / MASKED_KEYS / PUBLIC_KEYS 从 CONFIG_META 自动生成
 * 3. 分层暴露：公开配置 → 掩码配置 → 完整配置，逐级增加权限
 *
 * 新增配置键只需编辑 config-meta.ts 一个文件。
 */

import { configStore } from './store/index'
import {
  buildDefaults, buildHiddenKeys,
  buildMaskedKeys, buildPublicKeys,
} from './config-meta'

const PUBLIC_KEYS = buildPublicKeys()

// ========== Error Types ==========

export class AppError extends Error {
  constructor (
    public code: string,
    message: string,
    public statusCode = 400
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const ERR = {
  NEED_LOGIN: new AppError('NEED_LOGIN', '请先登录', 401),
  INVALID_CAPTCHA: new AppError('INVALID_CAPTCHA', '验证码验证失败', 400),
  RATE_LIMITED: new AppError('RATE_LIMITED', '请求过于频繁', 429),
  INVALID_INPUT: new AppError('INVALID_INPUT', '输入验证失败', 400),
  NOT_FOUND: new AppError('NOT_FOUND', '资源不存在', 404),
  INTERNAL: new AppError('INTERNAL', '服务器内部错误', 500),
}

// ========== Constants ==========

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024

// ========== AI Provider Config (Structured) ==========

export interface AIProviderConfig {
  name: string
  endpoint: string
  key: string
  format: 'openai' | 'anthropic' | 'google'
  models: string[]
}

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
  ENABLE_LIKE: boolean
  ENABLE_DISLIKE: boolean
  ENABLE_ARTICLE_REACTION?: boolean
  ENABLE_EMOTION: boolean
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

export const DEFAULT_CONFIG: TakoioConfig = buildDefaults() as unknown as TakoioConfig

// ========== Auto-Generated Allowed Keys ==========

/**
 * 从 DEFAULT_CONFIG 的 keys 自动生成允许修改的配置键白名单。
 * 确保新增配置项时自动包含，无需手动同步。
 */
export const ALLOWED_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof TakoioConfig)[]

// ========== Config Validation (Zod) ==========

import { z } from 'zod/v3'

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

// ========== Config Classification (auto-generated from CONFIG_META) ==========

const HIDDEN_KEYS = buildHiddenKeys()
const MASKED_KEYS = buildMaskedKeys()

/** 敏感配置键集合（用于掩码处理） */
export const SENSITIVE_CONFIG_KEYS = MASKED_KEYS

/** 公开 API 中必须排除的键（完全隐藏） */
export const PUBLIC_EXCLUDED_KEYS = HIDDEN_KEYS

// ========== Config Retrieval + Cache + Subscriptions ==========

let configCache: TakoioConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 15_000 // 15 seconds — shorter TTL reduces stale config in multi-instance deployments

// ponytail: removed subscribeConfigChange / notifyConfigChange — no subscribers exist

export const getConfig = async (event?: { context?: Record<string, any> }): Promise<TakoioConfig> => {
  // Request-level cache: avoid repeated DB reads within a single request
  if (event?.context?.__takoioConfig) return event.context.__takoioConfig as TakoioConfig
  if (configCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    if (event?.context) event.context.__takoioConfig = configCache
    return configCache
  }
  const dbConfig = await configStore.getConfig()
  configCache = { ...DEFAULT_CONFIG, ...dbConfig } as TakoioConfig
  cacheTimestamp = Date.now()
  if (event?.context) event.context.__takoioConfig = configCache
  return configCache!
}

export const invalidateConfig = () => {
  configCache = null
  cacheTimestamp = 0
}

// ========== Sensitive Config Masking ==========

/** 对敏感值做掩码处理：仅显示前 3 位和后 4 位，中间用 **** 替代 */
export const maskSensitiveValue = (value: string): string => {
  if (!value || value.length <= 7) return '****'
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

/**
 * 公开评论接口专用配置子集：仅返回前端展示必需的非敏感键。
 * maskSensitiveConfig 即便掩码也会泄露前 3+后 4 位密钥片段，
 * 公开接口不应返回任何敏感字段（即便是掩码形式）。
 *
 * 此函数为白名单模式，仅返回明确允许的公开键，其余一律不下发。
 */
export function publicConfigSubset (cfg: TakoioConfig): Partial<TakoioConfig> {
  const out: Record<string, any> = {}
  for (const key of PUBLIC_KEYS) {
    if (key in cfg) out[key] = cfg[key as keyof TakoioConfig]
  }
  return out as Partial<TakoioConfig>
}

export const maskSensitiveConfig = (cfg: TakoioConfig): TakoioConfig => {
  const ALLOWED = new Set<string>(ALLOWED_CONFIG_KEYS)
  const masked: Record<string, any> = {}
  for (const key of ALLOWED) {
    if (key in cfg) masked[key] = cfg[key as keyof TakoioConfig]
  }
  // 管理面板需要展示所有配置项（含 hidden 分类），仅对 masked 键做掩码保护。
  // hidden 分类仅用于公开 API（publicConfigSubset 白名单），不在管理 API 中删除。
  for (const key of SENSITIVE_CONFIG_KEYS) {
    if (masked[key] && typeof masked[key] === 'string' && masked[key].length > 0) {
      masked[key] = maskSensitiveValue(masked[key])
    }
  }
  return masked as TakoioConfig
}
