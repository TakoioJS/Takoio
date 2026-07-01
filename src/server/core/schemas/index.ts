/**
 * Zod schemas for input validation
 */

import { z } from 'zod'
import { ALLOWED_CONFIG_KEYS } from '../config'

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
  captchaToken: z.string().optional(),
})

export const PasswordSetSchema = z.object({
  password: z.string()
    .min(8, '密码至少 8 位')
    .max(128)
    .refine(v => !/^\d+$/.test(v), '密码不能全为数字')
    .refine(v => !/^[a-zA-Z]+$/.test(v), '密码不能全为字母'),
  setupToken: z.string().optional(),
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

/** 允许通过 SET_CONFIG 修改的配置键白名单 — 从 config.ts 的 DEFAULT_CONFIG 自动生成，永不同步 */

const ALLOWED_CONFIG_KEYS_TUPLE = ALLOWED_CONFIG_KEYS as unknown as [string, ...string[]]

export const SetConfigSchema = z.object({
  config: z.record(z.enum(ALLOWED_CONFIG_KEYS_TUPLE), z.unknown()).optional(),
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

// ========== Dashboard ==========

export const DashboardTrendSchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
})

// ========== Reaction ==========

export const ReactionGetSchema = z.object({
  url: z.string().default('/'),
})

export const ReactionSubmitSchema = z.object({
  url: z.string().default('/'),
  emoji: z.string().min(1),
})

export const CommentReactionGetSchema = z.object({
  id: z.string().min(1),
})

export const CommentReactionSubmitSchema = z.object({
  id: z.string().min(1).optional(), // id 可由 URL 路径提供，body 不必传
  emoji: z.string().min(1),
})

// ========== Admin (partial — missing schemas) ==========

export const TypeSetSchema = z.object({
  type: z.string().min(1).default('self-hosted'),
})

export const PrivateKeyGetSchema = z.object({
  key: z.string().min(1),
})

export const PrivateKeySetSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
})

export const SendNotificationSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
})

export const EmailTestSchema = z.object({
  email: z.string().email().optional(),
  template: z.enum(['user', 'admin']).optional(),
})

// ========== Import / Export ==========

export const ExportSchema = z.object({
  format: z.enum(['json', 'csv', 'takoio']).default('json'),
})

// ponytail: import endpoints accept messy data from external systems.
// - .nullish() over .optional(): JSON uses null for absent values, not undefined
// - preprocess coerce: booleans arrive as 0/1, numbers as strings
// - .passthrough(): unknown fields from any source are kept, not stripped

/** Coerce 0/1/"true"/"false" → boolean, preserve null/undefined */
const importBool = () => z.preprocess(
  (v) => {
    if (v === null || v === undefined) return v
    if (typeof v === 'boolean') return v
    return v === 1 || v === 'true' || v === '1'
  },
  z.boolean()
).nullish()

/** Coerce string numbers → number, preserve null/undefined */
const importNum = () => z.preprocess(
  (v) => {
    if (v === null || v === undefined) return v
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v !== '') return Number(v)
    return v
  },
  z.number()
).nullish()

const ImportCommentSchema = z.object({
  // Identifiers
  id: z.string().nullish(),
  objectId: z.string().nullish(),
  _id: z.string().nullish(),
  // Page / URL fields
  url: z.string().nullish(),
  page_key: z.string().nullish(),
  thread: z.string().nullish(),
  href: z.string().nullish(),
  // Author fields
  nick: z.string().nullish(),
  name: z.string().nullish(),
  mail: z.string().nullish(),
  email: z.string().nullish(),
  link: z.string().nullish(),
  mailMd5: z.string().nullish(),
  // Content fields
  comment: z.string().nullish(),
  content: z.string().nullish(),
  message: z.string().nullish(),
  ua: z.string().nullish(),
  userAgent: z.string().nullish(),
  ip: z.string().nullish(),
  ipRegion: z.string().nullish(),
  image: z.string().nullish(),
  sticker: z.string().nullish(),
  // Timestamp fields — accept number or string (ISO date)
  created: z.union([z.number(), z.string()]).nullish(),
  createdAt: z.union([z.number(), z.string()]).nullish(),
  created_at: z.union([z.number(), z.string()]).nullish(),
  insertedAt: z.union([z.number(), z.string()]).nullish(),
  time: z.union([z.number(), z.string()]).nullish(),
  // Parent references
  pid: z.string().nullish(),
  rid: z.string().nullish(),
  parent: z.string().nullish(),
  // State fields
  state: z.string().nullish(),
  status: z.string().nullish(),
  // Booleans — coerce from 0/1/"true"/"false"
  isSpam: importBool(),
  is_pinned: importBool(),
  isPinned: importBool(),
  isTop: importBool(),
  // Numbers — coerce from strings, preserve null/undefined
  like: importNum(),
  likes: importNum(),
  dislike: importNum(),
}).passthrough() // allow unknown fields from any import source

export const ImportSchema = z.object({
  json: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  valine: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  artalk: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  waline: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  twikoo: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  disqus: z.union([z.string(), z.array(ImportCommentSchema)]).optional(),
  takoio: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
})

// ========== Image ==========

export const UploadImageSchema = z.object({
  image: z.string().min(1).refine(v => /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(v) || /^[A-Za-z0-9+/=]+$/.test(v), {
    message: 'Invalid base64 image format',
  }),
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
export type CommentsCountData = z.infer<typeof CommentsCountSchema>
export type RecentCommentsData = z.infer<typeof RecentCommentsSchema>
export type CounterUpdateData = z.infer<typeof CounterUpdateSchema>
export type ImportData = z.infer<typeof ImportSchema>
export type ExportData = z.infer<typeof ExportSchema>
export type UploadImageData = z.infer<typeof UploadImageSchema>
export type ReactionGetData = z.infer<typeof ReactionGetSchema>
export type ReactionSubmitData = z.infer<typeof ReactionSubmitSchema>
export type CommentReactionGetData = z.infer<typeof CommentReactionGetSchema>
export type CommentReactionSubmitData = z.infer<typeof CommentReactionSubmitSchema>
export type TypeSetData = z.infer<typeof TypeSetSchema>
export type PrivateKeyGetData = z.infer<typeof PrivateKeyGetSchema>
export type PrivateKeySetData = z.infer<typeof PrivateKeySetSchema>
export type SendNotificationData = z.infer<typeof SendNotificationSchema>
export type EmailTestData = z.infer<typeof EmailTestSchema>
