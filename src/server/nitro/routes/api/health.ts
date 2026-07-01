/**
 * Serverless diagnostic health check — GET /api/health
 *
 * Lightweight: does NOT import or initialize the database.
 * Public response is minimal (status only). Redis connection
 * diagnostics require admin auth to avoid leaking internal state.
 */

import { getRedisClient } from '#core/store/redis'
import { requireAdmin } from '#core/auth'
// getToken — auto-imported from nitro/utils/ by Nitro

export default defineEventHandler(async (event) => {
  // Public: minimal liveness probe only
  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  // Admin-only diagnostics: Redis connection state + error details
  let redisDiagnostics: Record<string, unknown> | null = null
  try {
    await requireAdmin({ token: getToken(event) })
    redisDiagnostics = await collectRedisDiagnostics()
  } catch {
    // Not authenticated — return minimal public status only
  }

  return {
    status: 'ok',
    ...(redisDiagnostics ? { redis: redisDiagnostics } : {}),
  }
})

async function collectRedisDiagnostics (): Promise<Record<string, unknown>> {
  const redisUrl = process.env.REDIS_URL

  let redisStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'
  let redisError: string | undefined
  let redisClientStatus: string | undefined

  if (!redisUrl) {
    redisStatus = 'error'
    redisError = 'REDIS_URL environment variable is not set'
  } else {
    try {
      const client = await getRedisClient()
      if (client) {
        redisClientStatus = client.status
        const pong = await client.ping()
        redisStatus = pong === 'PONG' ? 'connected' : 'error'
        if (redisStatus === 'error') redisError = `Unexpected ping response: ${pong}`
      } else {
        redisStatus = 'error'
        redisError = 'getRedisClient() returned null (connection failed silently)'
      }
    } catch (e: any) {
      redisStatus = 'error'
      redisError = e?.message || String(e)
    }
  }

  return {
    urlConfigured: !!redisUrl,
    status: redisStatus,
    clientStatus: redisClientStatus,
    error: redisError,
  }
}
