/**
 * GET /api/auth/providers — report which social auth providers are enabled.
 */

import { getConfig } from '#core'

export default defineHandler(async () => {
  const cfg = await getConfig()
  return {
    github: !!cfg.SOCIAL_AUTH_GITHUB_ENABLED && !!(cfg.SOCIAL_AUTH_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID),
    google: !!cfg.SOCIAL_AUTH_GOOGLE_ENABLED && !!(cfg.SOCIAL_AUTH_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID),
    email: !!cfg.SOCIAL_AUTH_EMAIL_ENABLED,
  }
})
