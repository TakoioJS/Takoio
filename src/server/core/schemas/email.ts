import { z } from 'zod'

export const EmailSendSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  name: z.string().max(50).optional(),
})

export const EmailVerifySchema = z.object({
  uuid: z.string().uuid('UUID 格式不正确'),
  code: z.string().regex(/^\d{6}$/, '验证码必须是 6 位数字'),
})

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'code 必填'),
  state: z.string().min(8, 'state 必填'),
})

export type EmailSendData = z.infer<typeof EmailSendSchema>
export type EmailVerifyData = z.infer<typeof EmailVerifySchema>
export type OAuthCallbackData = z.infer<typeof OAuthCallbackSchema>
