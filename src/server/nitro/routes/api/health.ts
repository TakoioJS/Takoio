/**
 * Serverless diagnostic health check — GET /api/health
 *
 * Lightweight: does NOT import or initialize the database.
 * Public response is minimal (status only). Redis connection
 * diagnostics require admin auth to avoid leaking internal state.
 */

import { getRedisDiagnostics } from '#core/store/redis'
import { requireAdmin } from '#core/auth'
// getToken — auto-imported from nitro/utils/ by Nitro

export default defineHandler(async (event) => {
  // Public: minimal liveness probe only
  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  // Admin-only diagnostics: Redis connection state + error details
  let redisDiagnostics: Record<string, unknown> | null = null
  try {
    await requireAdmin({ token: getToken(event) })
    redisDiagnostics = await getRedisDiagnostics()
  } catch {
    // Not authenticated — return minimal public status only
  }

  return {
    status: 'ok',
    ...(redisDiagnostics ? { redis: redisDiagnostics } : {}),
  }
})
