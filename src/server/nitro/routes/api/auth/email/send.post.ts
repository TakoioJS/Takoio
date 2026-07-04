/**
 * POST /api/auth/email/send — generate verify code, store in cache, send email.
 */

import {
  getConfig,
  generateVerifyCode,
  setVerifyCode,
  redisRateLimit,
  sendEmail,
  EmailSendSchema,
  getClientIp,
  safeValidate,
} from '#core'

export default defineHandler(async (event) => {
  const cfg = await getConfig()
  if (!cfg.SOCIAL_AUTH_EMAIL_ENABLED) throw createError({ statusCode: 404, statusMessage: 'Email login not enabled' })

  const body = await readBody(event)
  const v = safeValidate(EmailSendSchema, body)
  if (!v.success) throw createError({ statusCode: 400, statusMessage: v.error })

  // 频率限制：5 次/IP/小时
  const ip = getClientIp(event)
  const allowed = await redisRateLimit(`oauth:email-send:${ip}`, 5, 60 * 60 * 1000)
  if (!allowed) throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })

  const code = generateVerifyCode()
  const user = {
    provider: 'email' as const,
    id: v.data.email,
    name: v.data.name || v.data.email.split('@')[0],
    email: v.data.email,
  }
  const uuid = crypto.randomUUID()
  await setVerifyCode(uuid, code, user)

  // 错误必须传播（不再 .catch(() => {}) 静默吞错）
  const result = await sendEmail(cfg, 'Takoio 登录验证码',
    `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
      <p>您的验证码是：</p>
      <div style="font-size:32px;font-weight:700;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;letter-spacing:8px;">${code}</div>
      <p style="color:#666;font-size:14px;">5 分钟内有效。如非本人操作请忽略。</p>
    </div>`)
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: `邮件发送失败: ${result.message}` })
  }

  return { uuid, message: '验证码已发送' }
})
