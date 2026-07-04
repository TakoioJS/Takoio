/**
 * GET /api/auth/google/callback — Google OAuth callback.
 */

import {
  createOAuthProviders,
  signToken,
  getState,
  consumeState,
  getConfig,
  OAuthCallbackSchema,
  safeValidate,
} from '#core'

function getSiteUrl (event: any): string {
  const origin = event.headers?.get?.('origin') || event.headers?.get?.('host') || ''
  return origin.startsWith('http') ? origin : `https://${origin}`
}

export default defineHandler(async (event) => {
  const query = getQuery(event) as { code?: string; state?: string }
  const v = safeValidate(OAuthCallbackSchema, query)
  if (!v.success) throw createError({ statusCode: 400, statusMessage: v.error })

  const stateOk = await getState(v.data.state)
  if (!stateOk) throw createError({ statusCode: 400, statusMessage: 'Invalid or expired state' })
  // 防重放：消费 state
  await consumeState(v.data.state)

  const cfg = await getConfig()
  if (!cfg.SOCIAL_AUTH_GOOGLE_ENABLED) throw createError({ statusCode: 404, statusMessage: 'Google login not enabled' })
  const providers = createOAuthProviders(getSiteUrl(event), cfg)
  if (!providers.google) throw createError({ statusCode: 404, statusMessage: 'Google login not configured' })

  const accessToken = await providers.google.getToken(v.data.code)
  const user = await providers.google.getUser(accessToken)
  const token = signToken(user)

  // 仅 token 跳转，user 信息由前端通过 /me 拿（避免 Referer 泄漏）
  return sendRedirect(event, `/__takoio_auth?token=${encodeURIComponent(token)}`)
})
