/**
 * Config management — defaults, retrieval, caching, masking
 */

/**
 * Application error types — structured errors with codes and HTTP status
 */

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

import { configStore } from './store/index'
import { ALLOWED_CONFIG_KEYS } from './schemas'

// ========== Constants ==========

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024

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
  AKISMET_KEY?: string
  ENABLE_ANTI_SPAM?: boolean
  CORS_ORIGINS: string
  CUSTOM_CSS?: string
  CDN_PREFIX?: string
  COMMENT_BG_IMAGE?: string
  PUSHOO_SC_KEY: string
  PUSHOO_QMSG_KEY: string
  PUSHOO_DINGTALK_TOKEN: string
  PUSHOO_WECOMBOT_TOKEN: string
  PUSHOO_WECOM_TOKEN: string
  PUSHOO_FEISHU_TOKEN: string
  PUSHOO_TELEGRAM_TOKEN: string
  PUSHOO_BARK_TOKEN: string
  PUSHOO_PUSHPLUS_TOKEN: string
  PUSHOO_PUSHPLUSHXTRIP_TOKEN: string
  PUSHOO_PUSHDEER_TOKEN: string
  PUSHOO_WXPUSHER_TOKEN: string
  PUSHOO_ONEBOT_TOKEN: string
  PUSHOO_ATRI_TOKEN: string
  PUSHOO_IGOT_TOKEN: string
  PUSHOO_DISCORD_TOKEN: string
  PUSHOO_IFTTT_TOKEN: string
  PUSHOO_JOIN_TOKEN: string
  PUSHOO_WEBHOOK_TOKEN: string
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
  SHOW_IP_REGION: 'all' as any,
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
  PUSHOO_SC_KEY: '',
  PUSHOO_QMSG_KEY: '',
  PUSHOO_DINGTALK_TOKEN: '',
  PUSHOO_WECOMBOT_TOKEN: '',
  PUSHOO_WECOM_TOKEN: '',
  PUSHOO_FEISHU_TOKEN: '',
  PUSHOO_TELEGRAM_TOKEN: '',
  PUSHOO_BARK_TOKEN: '',
  PUSHOO_PUSHPLUS_TOKEN: '',
  PUSHOO_PUSHPLUSHXTRIP_TOKEN: '',
  PUSHOO_PUSHDEER_TOKEN: '',
  PUSHOO_WXPUSHER_TOKEN: '',
  PUSHOO_ONEBOT_TOKEN: '',
  PUSHOO_ATRI_TOKEN: '',
  PUSHOO_IGOT_TOKEN: '',
  PUSHOO_DISCORD_TOKEN: '',
  PUSHOO_IFTTT_TOKEN: '',
  PUSHOO_JOIN_TOKEN: '',
  PUSHOO_WEBHOOK_TOKEN: '',
}

// ========== Config Retrieval + Cache ==========

let configCache: TakoioConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000 // 60 seconds

export const getConfig = async (): Promise<TakoioConfig> => {
  if (configCache && Date.now() - cacheTimestamp < CACHE_TTL) return configCache
  const dbConfig = await configStore.getConfig()
  configCache = { ...DEFAULT_CONFIG, ...dbConfig } as TakoioConfig
  cacheTimestamp = Date.now()
  return configCache!
}

export const invalidateConfig = () => {
  configCache = null
  cacheTimestamp = 0
}

// ========== Sensitive Config Masking ==========

export const SENSITIVE_CONFIG_KEYS = new Set([
  'SMTP_PASS',
  'IMAGE_HOSTING_TOKEN',
  'IMAGE_HOSTING_ACCESS_KEY',
  'IMAGE_HOSTING_SECRET_KEY',
  'CAPTCHA_SECRET_KEY',
  'CAPTCHA_SITE_KEY',

  'NSFW_API_KEY',
  // Pushoo notification tokens (18 channels)
  'PUSHOO_SC_KEY', 'PUSHOO_QMSG_KEY', 'PUSHOO_DINGTALK_TOKEN',
  'PUSHOO_WECOMBOT_TOKEN', 'PUSHOO_WECOM_TOKEN', 'PUSHOO_FEISHU_TOKEN',
  'PUSHOO_TELEGRAM_TOKEN', 'PUSHOO_BARK_TOKEN', 'PUSHOO_PUSHPLUS_TOKEN',
  'PUSHOO_PUSHPLUSHXTRIP_TOKEN', 'PUSHOO_PUSHDEER_TOKEN', 'PUSHOO_WXPUSHER_TOKEN',
  'PUSHOO_ONEBOT_TOKEN', 'PUSHOO_ATRI_TOKEN', 'PUSHOO_IGOT_TOKEN',
  'PUSHOO_DISCORD_TOKEN', 'PUSHOO_IFTTT_TOKEN', 'PUSHOO_JOIN_TOKEN',
  'PUSHOO_WEBHOOK_TOKEN',
])

/** 对敏感值做掩码处理：仅显示前 3 位和后 4 位，中间用 **** 替代 */
export const maskSensitiveValue = (value: string): string => {
  if (!value || value.length <= 7) return '****'
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

export const maskSensitiveConfig = (cfg: TakoioConfig): TakoioConfig => {
  const ALLOWED = new Set<string>(ALLOWED_CONFIG_KEYS)
  const masked: Record<string, any> = {}
  for (const key of ALLOWED) {
    if (key in cfg) masked[key] = cfg[key as keyof TakoioConfig]
  }
  for (const key of SENSITIVE_CONFIG_KEYS) {
    if (masked[key] && typeof masked[key] === 'string' && masked[key].length > 0) {
      masked[key] = maskSensitiveValue(masked[key])
    }
  }
  return masked as TakoioConfig
}
