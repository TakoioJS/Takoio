/**
 * GET /api/auth/google — redirect to Google OAuth authorize endpoint.
 */

import { createOAuthProviders, generateState, getConfig } from '#core'

function getSiteUrl (event: any): string {
  const origin = event.headers?.get?.('origin') || event.headers?.get?.('host') || ''
  return origin.startsWith('http') ? origin : `https://${origin}`
}

export default defineHandler(async (event) => {
  const cfg = await getConfig()
  if (!cfg.SOCIAL_AUTH_GOOGLE_ENABLED) throw createError({ statusCode: 404, statusMessage: 'Google login not enabled' })
  const providers = createOAuthProviders(getSiteUrl(event), cfg)
  if (!providers.google) throw createError({ statusCode: 404, statusMessage: 'Google login not configured' })
  const state = generateState()
  return sendRedirect(event, providers.google.authUrl(state))
})
