/**
 * Redis client singleton — connection management for knowledge base
 *
 * Uses ioredis with config from REDIS_URL.
 * Falls back gracefully when Redis is unavailable.
 */

import Redis from 'ioredis'
import { getConfig } from '../config'

let _client: Redis | null = null
let _connectPromise: Promise<Redis | null> | null = null

/**
 * Get or create a Redis client singleton.
 * Returns null if Redis is not configured or connection fails.
 */
export async function getRedisClient (): Promise<Redis | null> {
  if (_client?.status === 'ready') return _client

  if (_connectPromise) return _connectPromise

  _connectPromise = (async () => {
    try {
      const cfg = await getConfig()
      const url = cfg.REDIS_URL || 'redis://localhost:6379'

      _client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy (times) {
          if (times > 3) {
            console.warn('[redis] Max retry attempts reached, giving up')
            return null // stop retrying
          }
          return Math.min(times * 500, 3000)
        },
        lazyConnect: true,
        connectTimeout: 5000,
      })

      _client.on('error', (err) => {
        console.warn('[redis] Connection error:', err.message)
      })

      _client.on('ready', () => {
        console.info('[redis] Connected successfully')
      })

      await _client.connect()
      return _client
    } catch (e: any) {
      console.warn('[redis] Failed to connect:', e.message)
      _client = null
      _connectPromise = null
      return null
    }
  })()

  return _connectPromise
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable (): Promise<boolean> {
  try {
    const client = await getRedisClient()
    if (!client) return false
    await client.ping()
    return true
  } catch {
    return false
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis (): Promise<void> {
  if (_client) {
    await _client.quit().catch(() => _client?.disconnect())
    _client = null
    _connectPromise = null
  }
}
