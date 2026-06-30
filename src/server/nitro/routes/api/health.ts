/**
 * Serverless diagnostic health check — GET /api/health
 *
 * Lightweight: does NOT import or initialize the database.
 * Returns minimal status for deployment debugging.
 * Includes Redis connection diagnostics (safe — no credentials leaked).
 */

import { isDev } from '#core/utils/env'
import { getRedisClient } from '#core/store/redis'

export default defineEventHandler(async () => {
  const redisUrl = process.env.REDIS_URL
  const nodeEnv = process.env.NODE_ENV

  // Try Redis connection and capture the specific error
  let redisStatus: 'connected' | 'disconnected' | 'error' | 'skipped' = 'disconnected'
  let redisError: string | undefined
  let redisClientStatus: string | undefined

  if (isDev()) {
    redisStatus = 'skipped'
  } else if (!redisUrl) {
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
    status: 'ok',
    env: {
      nodeEnv,
      isDev: isDev(),
    },
    redis: {
      urlConfigured: !!redisUrl,
      urlProtocol: redisUrl ? redisUrl.split('://')[0] : undefined,
      status: redisStatus,
      clientStatus: redisClientStatus,
      error: redisError,
    },
  }
})
