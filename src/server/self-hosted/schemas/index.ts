/**
 * Zod schemas for input validation
 */

import { z } from 'zod'

// ========== Comment ==========

export const SubmitCommentSchema = z.object({
  url: z.string().min(1),
  href: z.string().optional(),
  nick: z.string().min(1).max(50).trim(),
  mail: z.string().email().optional().or(z.literal('')),
  link: z.string().url().optional().or(z.literal('')),
  comment: z.string().min(1).max(5000).trim(),
  pid: z.string().optional(),
  rid: z.string().optional(),
  ua: z.string().optional(),
  image: z.string().optional(),
  sticker: z.string().optional(),
  title: z.string().optional(),
  captchaToken: z.string().optional(),
  _token: z.string().optional(),
})

export const GetCommentSchema = z.object({
  url: z.string().default('/'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['newest', 'oldest', 'hottest']).default('newest'),
})

export const CommentIdSchema = z.object({
  id: z.string().min(1),
})

export const CommentActionSchema = z.object({
  id: z.string().min(1),
  hide: z.boolean().optional(),
})

// ========== Admin ==========

export const LoginSchema = z.object({
  password: z.string().min(8, '密码至少 8 位'),
})

export const PasswordSetSchema = z.object({
  password: z.string()
    .min(8, '密码至少 8 位')
    .max(128)
    .refine(v => !/^\d+$/.test(v), '密码不能全为数字')
    .refine(v => !/^[a-zA-Z]+$/.test(v), '密码不能全为字母'),
})

export const AdminCommentSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  filter: z.enum(['all', 'visible', 'hidden', 'spam', 'pending']).optional(),
})

export const UpdateCommentSchema = z.object({
  id: z.string().min(1),
  nick: z.string().min(1).max(50).trim().optional(),
  mail: z.string().email().optional().or(z.literal('')),
  mailMd5: z.string().optional(),
  link: z.string().url().optional().or(z.literal('')),
  comment: z.string().min(1).max(5000).trim().optional(),
})

// ========== Config ==========

/** 允许通过 SET_CONFIG 修改的配置键白名单 */
export const ALLOWED_CONFIG_KEYS = [
  'SITE_NAME', 'SITE_URL', 'MASTER', 'MASTER_NAME', 'GLOBAL_COLOR', 'PAGE_SIZE', 'COMMENT_SORT', 'COMMENT_LENGTH_MAX',
  'REQUIRED_FIELDS', 'COMMENT_NICK_REQUIRED', 'GRAVATAR_URL', 'GRAVATAR_DEFAULT',
  'MASTER_LABEL', 'MASTER_LABEL_COLOR', 'COMMENT_BG_IMAGE',
  'ENABLE_VISITOR_COUNTER', 'COMMENT_PAGINATION_MODE', 'COMMENT_RATE_LIMIT',
  'AUDIT_MODE', 'IP_REGION_ENABLED', 'IP_PROXY_HEADER', 'SHOW_IP_REGION', 'SHOW_UA_INFO', 'ENABLE_LIKE',
  'ENABLE_DISLIKE', 'ENABLE_ARTICLE_REACTION', 'ENABLE_EMOTION', 'ENABLE_LINK_INPUT', 'COMMENT_LINK_REQUIRED',
  'ENABLE_ADMIN_KEYWORD', 'ADMIN_KEYWORD', 'ENABLE_CODE_HIGHLIGHT',
  'CODE_HIGHLIGHT_THEME', 'CODE_SHOW_LANGUAGE', 'CODE_SHOW_COPY',
  'ENABLE_CAPTCHA', 'ENABLE_IMAGE_UPLOAD',
  'CAPTCHA_PROVIDER', 'CAPTCHA_TYPE', 'CAPTCHA_SITE_KEY', 'CAPTCHA_SECRET_KEY',
  'IMAGE_HOSTING_PROVIDER', 'IMAGE_HOSTING_ENDPOINT', 'IMAGE_HOSTING_TOKEN',
  'IMAGE_HOSTING_BUCKET', 'IMAGE_HOSTING_REGION',
  'IMAGE_HOSTING_ACCESS_KEY', 'IMAGE_HOSTING_SECRET_KEY', 'IMAGE_HOSTING_CDN_DOMAIN',
  'ENABLE_NSFW_DETECTION', 'NSFW_SERVICE', 'NSFW_ENDPOINT', 'NSFW_API_KEY', 'NSFW_THRESHOLD',
  'BLOCKED_KEYWORDS',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TO', 'SMTP_TLS',
  'ENABLE_MAIL_NOTIFICATION', 'MAIL_NOTIFY_ENABLED',
  'SENDER_EMAIL', 'SENDER_NAME', 'MAIL_SUBJECT', 'MAIL_TEMPLATE',
  'MAIL_SUBJECT_ADMIN', 'MAIL_TEMPLATE_ADMIN',
  'AKISMET_KEY', 'ENABLE_ANTI_SPAM',
  'CUSTOM_CSS', 'CDN_PREFIX',
  'AUTO_AUDIT_METHOD', 'AUTO_AUDIT_AI_PROVIDER', 'AUTO_AUDIT_AI_MODEL', 'AI_PROVIDERS', 'AUTO_AUDIT_AI_PROMPT',
  'CORS_ORIGINS',
  // Pushoo tokens
  'PUSHOO_SC_KEY', 'PUSHOO_QMSG_KEY', 'PUSHOO_DINGTALK_TOKEN',
  'PUSHOO_WECOMBOT_TOKEN', 'PUSHOO_WECOM_TOKEN', 'PUSHOO_FEISHU_TOKEN',
  'PUSHOO_TELEGRAM_TOKEN', 'PUSHOO_BARK_TOKEN', 'PUSHOO_PUSHPLUS_TOKEN',
  'PUSHOO_PUSHPLUSHXTRIP_TOKEN', 'PUSHOO_PUSHDEER_TOKEN', 'PUSHOO_WXPUSHER_TOKEN',
  'PUSHOO_ONEBOT_TOKEN', 'PUSHOO_ATRI_TOKEN', 'PUSHOO_IGOT_TOKEN',
  'PUSHOO_DISCORD_TOKEN', 'PUSHOO_IFTTT_TOKEN', 'PUSHOO_JOIN_TOKEN',
  'PUSHOO_WEBHOOK_TOKEN',
  
] as const

export const SetConfigSchema = z.object({
  config: z.record(z.enum(ALLOWED_CONFIG_KEYS), z.unknown()),
})

// ========== Counter ==========

export const CounterGetSchema = z.object({
  url: z.string().default('/'),
  href: z.string().optional(),
  title: z.string().optional(),
})

export const CounterUpdateSchema = z.object({
  url: z.string().default('/'),
  title: z.string().optional(),
})

export const CommentsCountSchema = z.object({
  urls: z.array(z.string()),
})

export const RecentCommentsSchema = z.object({
  count: z.coerce.number().int().positive().default(10),
})

// ========== Import / Export ==========

export const ExportSchema = z.object({
  format: z.enum(['json', 'csv', 'takoio']).default('json'),
})

export const ImportSchema = z.object({
  json: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  valine: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  artalk: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  waline: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  twikoo: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  disqus: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
  takoio: z.union([z.string(), z.record(z.unknown())]).optional(),
})

// ========== Image ==========

export const UploadImageSchema = z.object({
  image: z.string().min(1),
})

// ========== Helper ==========

/** Validate and return parsed data, throws ZodError on failure */
export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data)
}

/** Safe validation returning result object */
export const safeValidate = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }
}

// ========== Inferred Types ==========

export type SubmitCommentData = z.infer<typeof SubmitCommentSchema>
export type GetCommentData = z.infer<typeof GetCommentSchema>
export type CommentIdData = z.infer<typeof CommentIdSchema>
export type CommentActionData = z.infer<typeof CommentActionSchema>
export type LoginData = z.infer<typeof LoginSchema>
export type PasswordSetData = z.infer<typeof PasswordSetSchema>
export type AdminCommentData = z.infer<typeof AdminCommentSchema>
export type UpdateCommentData = z.infer<typeof UpdateCommentSchema>
export type CounterGetData = z.infer<typeof CounterGetSchema>
export type CounterUpdateData = z.infer<typeof CounterUpdateSchema>
export type ImportData = z.infer<typeof ImportSchema>
export type ExportData = z.infer<typeof ExportSchema>
export type UploadImageData = z.infer<typeof UploadImageSchema>
