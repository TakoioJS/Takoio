import { api } from './client'

/**
 * ConfigData — 管理面板配置数据类型
 *
 * 基于 DEFAULT_CONFIG 的字段类型定义，替代 [key: string]: any。
 * 所有字段均为 optional，因为 GET/SAVE 时只涉及部分字段。
 */
export interface ConfigData {
  // 基础
  SITE_NAME?: string
  SITE_URL?: string
  MASTER?: string
  MASTER_NAME?: string
  MASTER_LABEL?: string
  MASTER_LABEL_COLOR?: string
  GRAVATAR_URL?: string
  GRAVATAR_URL_CUSTOM?: string
  GRAVATAR_DEFAULT?: string
  REQUIRED_FIELDS?: string[]
  // 外观
  GLOBAL_COLOR?: string
  COMMENT_BG_IMAGE?: string
  // 评论
  COMMENT_SORT?: 'newest' | 'oldest' | 'hottest'
  COMMENT_PAGINATION_MODE?: 'pagination' | 'readmore'
  PAGE_SIZE?: number
  COMMENT_LENGTH_MAX?: number
  COMMENT_FEATURES?: string[]
  // 安全
  COMMENT_RATE_LIMIT?: number
  IP_PROXY_HEADER?: string | string[]
  IP_REGION_ENABLED?: boolean
  SHOW_IP_REGION?: string | boolean
  TRUSTED_PROXIES?: string
  AUDIT_MODE?: boolean
  AUTO_AUDIT_METHOD?: string
  AKISMET_KEY?: string
  AUTO_AUDIT_AI_PROVIDER?: string
  AUTO_AUDIT_AI_MODEL?: string
  AUTO_AUDIT_AI_PROMPT?: string
  BLOCKED_KEYWORDS?: string
  ENABLE_CAPTCHA?: boolean
  CAPTCHA_PROVIDER?: string
  CAPTCHA_TYPE?: string
  CAPTCHA_SITE_KEY?: string
  CAPTCHA_SECRET_KEY?: string
  // 邮件
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USER?: string
  SMTP_PASS?: string
  SENDER_EMAIL?: string
  SENDER_NAME?: string
  SMTP_TLS?: boolean
  ENABLE_MAIL_NOTIFICATION?: boolean
  MAIL_SUBJECT?: string
  MAIL_TEMPLATE?: string
  MAIL_SUBJECT_ADMIN?: string
  MAIL_TEMPLATE_ADMIN?: string
  // 推送
  PUSHOO_CHANNELS?: string
  // 代码高亮
  ENABLE_CODE_HIGHLIGHT?: boolean
  CODE_HIGHLIGHT_THEME?: string
  CODE_SHOW_LANGUAGE?: boolean
  CODE_SHOW_COPY?: boolean
  CODE_FEATURES?: string[]
  // 图片上传
  ENABLE_IMAGE_UPLOAD?: boolean
  IMAGE_HOSTING_PROVIDER?: string
  IMAGE_HOSTING_TOKEN?: string
  IMAGE_HOSTING_ENDPOINT?: string
  IMAGE_HOSTING_BUCKET?: string
  IMAGE_HOSTING_REGION?: string
  IMAGE_HOSTING_ACCESS_KEY?: string
  IMAGE_HOSTING_SECRET_KEY?: string
  IMAGE_HOSTING_CDN_DOMAIN?: string
  // AI
  AI_PROVIDERS?: string
  AI_SUMMARY_ENABLED?: boolean
  AI_SUMMARY_PROVIDER?: string
  AI_SUMMARY_MODEL?: string
  ENABLE_SUMMARY?: boolean
  // NSFW
  ENABLE_NSFW_DETECTION?: boolean
  NSFW_SERVICE?: string
  NSFW_ENDPOINT?: string
  NSFW_API_KEY?: string
  NSFW_THRESHOLD?: number
  // 高级
  CORS_ORIGINS?: string
  CUSTOM_CSS?: string
  ENABLE_VISITOR_COUNTER?: boolean
  // 允许扩展未知字段（向后兼容）
  [key: string]: unknown
}

export const configApi = {
  get: () =>
    api.get<{ data: ConfigData }>('/api/admin/config'),

  save: (config: ConfigData) =>
    api.put<{ success: boolean; skipped?: Record<string, string> }>('/api/admin/config', { config }),

  reset: () =>
    api.delete<{ success: boolean }>('/api/admin/config'),

  testEmail: (email: string, template: string) =>
    api.post('/api/admin/email-test', { email, template }),
}
