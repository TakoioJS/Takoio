/**
 * POST /api/auth/email/verify — verify the code, return signed JWT.
 */

import {
  consumeVerifyCode,
  signToken,
  EmailVerifySchema,
  safeValidate,
} from '#core'

export default defineHandler(async (event) => {
  const body = await readBody(event)
  const v = safeValidate(EmailVerifySchema, body)
  if (!v.success) throw createError({ statusCode: 400, statusMessage: v.error })

  const user = await consumeVerifyCode(v.data.uuid, v.data.code)
  if (!user) throw createError({ statusCode: 400, statusMessage: '验证码错误或已过期' })

  const token = signToken(user)
  return {
    token,
    user: {
      provider: user.provider,
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    }
  }
})
