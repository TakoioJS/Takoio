/**
 * POST /api/auth/email/verify — verify the code, return signed JWT.
 */

import {
  consumeVerifyCode,
  signToken,
  userStore,
  redisRateLimit,
  EmailVerifySchema,
  safeValidate,
  getClientIp,
} from '#core'
import { buildRequestContext } from '../../../../utils/request-context'

export default defineHandler(async (event) => {
  const body = await readBody(event)
  const v = safeValidate(EmailVerifySchema, body)
  if (!v.success) throw createError({ statusCode: 400, statusMessage: v.error })

  // 独立限流：验证码校验接口是暴力枚举的高价值目标
  const ip = await getClientIp(buildRequestContext(event))
  const ipAllowed = await redisRateLimit(`oauth:email-verify:${ip}`, 10, 60 * 60 * 1000)
  if (!ipAllowed) throw createError({ statusCode: 429, statusMessage: '验证次数过多，请稍后再试' })

  const user = await consumeVerifyCode(v.data.uuid, v.data.code)
  if (!user) throw createError({ statusCode: 400, statusMessage: '验证码错误或已过期' })

  // 持久化用户（首次登录自动创建）
  await userStore.upsertUser(user).catch(() => {})

  const token = await signToken(user)
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
