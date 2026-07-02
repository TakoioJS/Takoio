/**
 * Social Auth routes — OAuth 2.0 + Email verification
 *
 * GET  /api/auth/github           → redirect to GitHub
 * GET  /api/auth/github/callback  → GitHub OAuth callback
 * GET  /api/auth/google           → redirect to Google
 * GET  /api/auth/google/callback  → Google OAuth callback
 * POST /api/auth/email/send       → send verification code
 * POST /api/auth/email/verify     → verify code, return JWT
 * GET  /api/auth/me               → current user info
 * POST /api/auth/logout           → no-op (JWT is stateless)
 */

import {
  createOAuthProviders,
  generateState,
  verifyState,
  signToken,
  verifyToken,
  generateVerifyCode,
  storeVerifyCode,
  verifyEmailCode,
} from '#core/auth-social'
import { sendEmail } from '#core/email'
import { getConfig } from '#core/config'
import type { AuthUser } from '#core/auth-social'

// Helper: get site URL from config or request
function getSiteUrl (event: any): string {
  const origin = event.headers?.get?.('origin') || event.headers?.get?.('host') || ''
  return origin.startsWith('http') ? origin : `https://${origin}`
}

export default defineHandler(async (event) => {
  const fullPath = getRequestURL(event).pathname
  const path = fullPath.replace('/api/auth', '') || '/'

  // ---------- GitHub OAuth ----------
  if (path === '/github') {
    const cfg = await getConfig()
    const providers = createOAuthProviders(getSiteUrl(event), cfg)
    if (!providers.github) throw createError({ statusCode: 404, statusMessage: 'GitHub login not configured' })
    const state = generateState()
    return sendRedirect(event, providers.github.authUrl(state))
  }

  if (path === '/github/callback') {
    const query = getQuery(event) as { code?: string; state?: string }
    if (!query.code || !query.state) throw createError({ statusCode: 400, statusMessage: 'Missing code or state' })
    if (!verifyState(query.state)) throw createError({ statusCode: 400, statusMessage: 'Invalid state' })

    const cfg = await getConfig()
    const providers = createOAuthProviders(getSiteUrl(event), cfg)
    if (!providers.github) throw createError({ statusCode: 404, statusMessage: 'GitHub login not configured' })

    const accessToken = await providers.github.getToken(query.code)
    const user = await providers.github.getUser(accessToken)
    const token = signToken(user)

    // Redirect back with token in hash (JS extracts it, no server leak)
    return sendRedirect(event, `/__takoio_auth?token=${encodeURIComponent(token)}&name=${encodeURIComponent(user.name)}${user.avatar ? `&avatar=${encodeURIComponent(user.avatar)}` : ''}`)
  }

  // ---------- Google OAuth ----------
  if (path === '/google') {
    const cfg = await getConfig()
    const providers = createOAuthProviders(getSiteUrl(event), cfg)
    if (!providers.google) throw createError({ statusCode: 404, statusMessage: 'Google login not configured' })
    const state = generateState()
    return sendRedirect(event, providers.google.authUrl(state))
  }

  if (path === '/google/callback') {
    const query = getQuery(event) as { code?: string; state?: string }
    if (!query.code || !query.state) throw createError({ statusCode: 400, statusMessage: 'Missing code or state' })
    if (!verifyState(query.state)) throw createError({ statusCode: 400, statusMessage: 'Invalid state' })

    const cfg = await getConfig()
    const providers = createOAuthProviders(getSiteUrl(event), cfg)
    if (!providers.google) throw createError({ statusCode: 404, statusMessage: 'Google login not configured' })

    const accessToken = await providers.google.getToken(query.code)
    const user = await providers.google.getUser(accessToken)
    const token = signToken(user)

    return sendRedirect(event, `/__takoio_auth?token=${encodeURIComponent(token)}&name=${encodeURIComponent(user.name)}${user.avatar ? `&avatar=${encodeURIComponent(user.avatar)}` : ''}`)
  }

  // ---------- Email Verification ----------
  if (path === '/email/send' && event.method === 'POST') {
    const cfg = await getConfig()
    if (!cfg.SOCIAL_AUTH_EMAIL_ENABLED) throw createError({ statusCode: 403, statusMessage: 'Email login not enabled' })
    const body = await readBody(event) as { email?: string; name?: string }
    if (!body.email) throw createError({ statusCode: 400, statusMessage: 'Email required' })

    const uuid = crypto.randomUUID()
    const code = generateVerifyCode()
    const user: AuthUser = {
      provider: 'email',
      id: body.email,
      name: body.name || body.email.split('@')[0],
      email: body.email,
    }
    storeVerifyCode(uuid, code, user)

    await sendEmail(cfg, 'Takoio 登录验证码', `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
      <p>您的验证码是：</p>
      <div style="font-size:32px;font-weight:700;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;letter-spacing:8px;">${code}</div>
      <p style="color:#666;font-size:14px;">5 分钟内有效。如非本人操作请忽略。</p>
    </div>`).catch(() => { /* email may not be configured */ })

    return { uuid, message: '验证码已发送' }
  }

  if (path === '/email/verify' && event.method === 'POST') {
    const body = await readBody(event) as { uuid?: string; code?: string }
    if (!body.uuid || !body.code) throw createError({ statusCode: 400, statusMessage: 'uuid and code required' })

    const user = verifyEmailCode(body.uuid, body.code)
    if (!user) throw createError({ statusCode: 400, statusMessage: '验证码错误或已过期' })

    const token = signToken(user)
    return { token, user: { name: user.name, email: user.email, provider: user.provider } }
  }

  // ---------- Current User ----------
  if (path === '/me' && event.method === 'GET') {
    const authHeader = event.headers?.get?.('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return { user: null }

    const user = verifyToken(token)
    return { user }
  }

  // ---------- Logout (no-op, JWT is stateless) ----------
  if (path === '/logout' && event.method === 'POST') {
    return { success: true }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
