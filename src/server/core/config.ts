/**
 * Config management — defaults, retrieval, caching, masking, and change subscriptions.
 *
 * 设计原则：
 * 1. 单一来源：DEFAULT_CONFIG 是配置的唯一真实来源
 * 2. 自动同步：ALLOWED_CONFIG_KEYS 从 DEFAULT_CONFIG 自动生成，永不同步
 * 3. 分层暴露：公开配置 → 掩码配置 → 完整配置，逐级增加权限
 * 4. 变更订阅：配置更新自动触发缓存失效，无需手动调用 invalidateConfig
 */

import { configStore } from './store/index'

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
export function serializeAIProviders(providers: AIProviderConfig[]): string {
  return JSON.stringify(providers)
}

/** 将 JSON 字符串反序列化为 AI Provider 配置数组 */
export function deserializeAIProviders(json: string): AIProviderConfig[] {
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
  PUSHOO_CHANNELS: string
}

// ========== Default Config ==========

export const DEFAULT_CONFIG: TakoioConfig = {
  SITE_NAME: 'My Blog',
  MASTER_NAME: '',
  GLOBAL_COLOR: '',
  PAGE_SIZE: 10,
  COMMENT_SORT: 'newest',
  COMMENT_LENGTH_MAX: 500,
  REQUIRED_FIELDS: ['nick'],
  COMMENT_NICK_REQUIRED: true,
  GRAVATAR_URL: 'https://weavatar.com/avatar/',
  GRAVATAR_DEFAULT: 'identicon',
  ENABLE_VISITOR_COUNTER: true,
  COMMENT_PAGINATION_MODE: 'pagination',
  COMMENT_RATE_LIMIT: 30000,
  AUDIT_MODE: false,
  IP_REGION_ENABLED: true,
  IP_PROXY_HEADER: '',
  TRUSTED_PROXIES: '',
  SHOW_IP_REGION: 'all' as unknown as boolean,
  SHOW_UA_INFO: true,
  ENABLE_LIKE: true,
  ENABLE_DISLIKE: true,
  ENABLE_EMOTION: true,
  ENABLE_LINK_INPUT: true,
  COMMENT_LINK_REQUIRED: false,
  ENABLE_ADMIN_KEYWORD: false,
  ADMIN_KEYWORD: '#admin',
  ENABLE_CODE_HIGHLIGHT: true,
  CODE_HIGHLIGHT_THEME: 'one-dark-pro',
  CODE_SHOW_LANGUAGE: true,
  CODE_SHOW_COPY: true,
  ENABLE_CAPTCHA: false,
  ENABLE_IMAGE_UPLOAD: false,
  CAPTCHA_PROVIDER: 'turnstile',
  CAPTCHA_TYPE: 'checkbox',
  IMAGE_HOSTING_PROVIDER: '',
  IMAGE_HOSTING_ENDPOINT: '',
  IMAGE_HOSTING_TOKEN: '',
  IMAGE_HOSTING_BUCKET: '',
  IMAGE_HOSTING_REGION: '',
  IMAGE_HOSTING_ACCESS_KEY: '',
  IMAGE_HOSTING_SECRET_KEY: '',
  IMAGE_HOSTING_CDN_DOMAIN: '',
  ENABLE_NSFW_DETECTION: false,
  NSFW_SERVICE: 'self',
  NSFW_ENDPOINT: '',
  NSFW_API_KEY: '',
  NSFW_THRESHOLD: 0.5,
  BLOCKED_KEYWORDS: '赌博,博彩,外围,买分,卖分,刷分,代发,推广,SEO,裸聊,约炮,成人,刷屏,恶意攻击,小姐,招嫖',
  SMTP_HOST: '',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  SMTP_TO: '',
  SMTP_TLS: false,
  ENABLE_MAIL_NOTIFICATION: false,
  SENDER_EMAIL: '',
  SENDER_NAME: '',
  CAPTCHA_SECRET_KEY: '',
  CAPTCHA_SITE_KEY: '',
  AUTO_AUDIT_METHOD: '',
  AUTO_AUDIT_AI_PROVIDER: '',
  AUTO_AUDIT_AI_MODEL: '',
  AUTO_AUDIT_AI_PROMPT: '',
  AI_PROVIDERS: '[]',
  AI_SUMMARY_ENABLED: true,
  AI_SUMMARY_PROVIDER: '',
  AI_SUMMARY_MODEL: '',
  ENABLE_SUMMARY: true,
  MAIL_SUBJECT: '有人在 {title} 中回复了你',
  MAIL_TEMPLATE: `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333">
  <div style="text-align:center;padding:16px 0;font-size:22px;font-weight:700;color:#10b981">{{ siteName }}</div>
  <div style="background:#f9fafb;border-radius:10px;padding:20px;margin:12px 0">
    <div style="font-size:14px;color:#666;margin-bottom:8px"><strong style="color:#333">{{ nick }}</strong> 回复了你：</div>
    <div style="font-size:15px;line-height:1.7;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap">{{ comment }}</div>
  </div>
  <div style="text-align:center;margin:20px 0"><a href="{{ url }}" style="display:inline-block;padding:10px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">查看回复</a></div>
  <div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:14px">来自 {{ siteName }} 的邮件通知</div>
</div>`,
  MAIL_SUBJECT_ADMIN: '新的评论：{nick} 在 {title}',
  MAIL_TEMPLATE_ADMIN: `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333">
  <div style="text-align:center;padding:16px 0;font-size:22px;font-weight:700;color:#10b981">{{ siteName }}</div>
  <div style="background:#f9fafb;border-radius:10px;padding:20px;margin:12px 0">
    <div style="font-size:13px;color:#666;margin-bottom:10px">访客 <strong style="color:#333">{{ nick }}</strong> 在文章 <strong>{{ title }}</strong> 中发表了新评论</div>
    <div style="font-size:15px;line-height:1.7;padding:14px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;margin-bottom:10px">{{ comment }}</div>
    <div style="font-size:12px;color:#999;border-top:1px solid #e5e7eb;padding-top:8px">IP: {{ ip }} ｜ UA: {{ ua }}</div>
  </div>
  <div style="text-align:center;margin:20px 0"><a href="{{ url }}" style="display:inline-block;padding:10px 28px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">管理评论</a></div>
  <div style="font-size:12px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:14px">{{ siteName }} · 管理通知</div>
</div>`,
  CORS_ORIGINS: '',
  PUSHOO_CHANNELS: '',
}

// ========== Auto-Generated Allowed Keys ==========

/**
 * 从 DEFAULT_CONFIG 的 keys 自动生成允许修改的配置键白名单。
 * 确保新增配置项时自动包含，无需手动同步。
 */
export const ALLOWED_CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof TakoioConfig)[]

// ========== Config Classification ==========

/**
 * 配置敏感级别分类：
 * - hidden: 完全不出现在任何 API 响应中
 * - masked: 出现在 admin API 中但值被掩码
 * - public: 可出现在公开 API 中
 */

const HIDDEN_KEYS = new Set([
  'AI_PROVIDERS', 'AKISMET_KEY', 'AUTO_AUDIT_AI_PROMPT', 'MASTER',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_FROM', 'SMTP_TO', 'SMTP_TLS',
  'SMTP_PASS', 'PUSHOO_CHANNELS',
  'SENDER_EMAIL', 'IMAGE_HOSTING_ENDPOINT', 'IMAGE_HOSTING_BUCKET', 'IMAGE_HOSTING_REGION',
  'IMAGE_HOSTING_CDN_DOMAIN', 'NSFW_ENDPOINT', 'NSFW_THRESHOLD', 'NSFW_SERVICE',
  'CORS_ORIGINS', 'IP_PROXY_HEADER', 'TRUSTED_PROXIES',
  'AUTO_AUDIT_METHOD', 'AUTO_AUDIT_AI_PROVIDER', 'AUTO_AUDIT_AI_MODEL',
  'AI_SUMMARY_PROVIDER', 'AI_SUMMARY_MODEL', 'BLOCKED_KEYWORDS',
])

const MASKED_KEYS = new Set([
  'SMTP_PASS', 'IMAGE_HOSTING_TOKEN', 'IMAGE_HOSTING_ACCESS_KEY', 'IMAGE_HOSTING_SECRET_KEY',
  'CAPTCHA_SECRET_KEY', 'NSFW_API_KEY', 'PUSHOO_CHANNELS',
])

/** 敏感配置键集合（用于掩码处理） */
export const SENSITIVE_CONFIG_KEYS = MASKED_KEYS

/** 公开 API 中必须排除的键（完全隐藏） */
export const PUBLIC_EXCLUDED_KEYS = HIDDEN_KEYS

// ========== Config Retrieval + Cache + Subscriptions ==========

let configCache: TakoioConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000 // 60 seconds

/** 配置变更订阅回调 */
const configChangeListeners = new Set<() => void>()

/** 订阅配置变更事件 */
export function subscribeConfigChange(listener: () => void): () => void {
  configChangeListeners.add(listener)
  return () => configChangeListeners.delete(listener)
}

/** 触发所有配置变更订阅 */
export function notifyConfigChange(): void {
  invalidateConfig()
  for (const listener of configChangeListeners) {
    try { listener() } catch { /* ignore listener errors */ }
  }
}

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
  const PUBLIC_ALLOWED_KEYS: ReadonlySet<string> = new Set([
    // 基础展示
    'SITE_NAME', 'SITE_URL', 'MASTER_NAME', 'GLOBAL_COLOR', 'PAGE_SIZE', 'COMMENT_SORT', 'COMMENT_LENGTH_MAX',
    'GRAVATAR_URL', 'GRAVATAR_URL_CUSTOM', 'GRAVATAR_DEFAULT', 'MASTER_LABEL', 'MASTER_LABEL_COLOR', 'COMMENT_BG_IMAGE',
    // 行为开关
    'REQUIRED_FIELDS', 'COMMENT_NICK_REQUIRED', 'COMMENT_PAGINATION_MODE', 'COMMENT_RATE_LIMIT',
    'ENABLE_VISITOR_COUNTER', 'ENABLE_LIKE', 'ENABLE_DISLIKE', 'ENABLE_ARTICLE_REACTION', 'ENABLE_EMOTION',
    'ENABLE_LINK_INPUT', 'COMMENT_LINK_REQUIRED', 'COMMENT_FEATURES',
    'ENABLE_CODE_HIGHLIGHT', 'CODE_HIGHLIGHT_THEME', 'CODE_SHOW_LANGUAGE', 'CODE_SHOW_COPY',
    'ENABLE_CAPTCHA', 'CAPTCHA_PROVIDER', 'CAPTCHA_TYPE', 'CAPTCHA_SITE_KEY',
    'ENABLE_IMAGE_UPLOAD', 'IMAGE_HOSTING_PROVIDER',
    'ENABLE_NSFW_DETECTION',
    'ENABLE_MAIL_NOTIFICATION', 'MAIL_NOTIFY_ENABLED',
    'SENDER_NAME', 'MAIL_SUBJECT', 'MAIL_SUBJECT_ADMIN',
    'ENABLE_ANTI_SPAM', 'ENABLE_SUMMARY', 'AI_SUMMARY_ENABLED',
    'AUDIT_MODE', 'IP_REGION_ENABLED', 'SHOW_IP_REGION',
    'CUSTOM_CSS', 'CDN_PREFIX',
  ])
  const out: Record<string, any> = {}
  for (const key of PUBLIC_ALLOWED_KEYS) {
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
  // Drop secrets that must not be exposed at all (C2/H3)
  for (const key of PUBLIC_EXCLUDED_KEYS) {
    delete masked[key]
  }
  for (const key of SENSITIVE_CONFIG_KEYS) {
    if (masked[key] && typeof masked[key] === 'string' && masked[key].length > 0) {
      masked[key] = maskSensitiveValue(masked[key])
    }
  }
  return masked as TakoioConfig
}
