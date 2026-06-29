/**
 * Redis client singleton — connection management for knowledge base
 *
 * Uses ioredis with config from REDIS_URL environment variable.
 * Falls back gracefully when Redis is unavailable.
 */

import Redis from 'ioredis'

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
      const url = process.env.REDIS_URL || 'redis://localhost:6379'

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

// ========== Summary cache ==========

import { createHash } from 'node:crypto'

interface SummaryCacheData {
  url: string
  summary: string
  keywords: string[]
  title?: string
  created: number
}

const SUMMARY_TTL = 2_592_000 // 30 days
// C3: cache key binds to both url and content hash, so attacker can't poison a legit URL's cache with different content
const summaryCacheKey = (url: string, content: string): string =>
  `takoio:summary:${createHash('md5').update(url).digest('hex')}:${createHash('sha256').update(content).digest('hex').slice(0, 16)}`

// Memory fallback when Redis is unavailable
const _memCache = new Map<string, { data: SummaryCacheData; expire: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _memCache) if (v.expire < now) _memCache.delete(k)
}, 60_000).unref()

export async function getSummaryCache (url: string, content: string): Promise<SummaryCacheData | null> {
  const key = summaryCacheKey(url, content)
  try {
    const client = await getRedisClient()
    if (client) {
      const raw = await client.get(key)
      if (raw) return JSON.parse(raw) as SummaryCacheData
    }
  } catch { /* fall through to memory */ }
  const mem = _memCache.get(key)
  if (mem && mem.expire > Date.now()) return mem.data
  return null
}

export async function setSummaryCache (url: string, content: string, data: SummaryCacheData): Promise<void> {
  const key = summaryCacheKey(url, content)
  const payload = JSON.stringify(data)
  try {
    const client = await getRedisClient()
    if (client) {
      await client.set(key, payload, 'EX', SUMMARY_TTL)
      return
    }
  } catch { /* fall through to memory */ }
  _memCache.set(key, { data, expire: Date.now() + SUMMARY_TTL * 1000 })
}

// ========== Redis-backed rate limiting (H2 fix) ==========
// In-memory Map-based rate limiters are ineffective in serverless / multi-instance deployments.
// This function uses Redis INCR + EXPIRE for a sliding-window counter, with in-memory fallback.

const _memRateBuckets = new Map<string, { count: number; reset: number }>()

export async function redisRateLimit (
  identifier: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const key = `takoio:rate:${identifier}`
  try {
    const client = await getRedisClient()
    if (client) {
      const count = await client.incr(key)
      if (count === 1) {
        await client.pexpire(key, windowMs)
      }
      return count <= max
    }
  } catch { /* fall through to memory */ }
  // Memory fallback
  const now = Date.now()
  const bucket = _memRateBuckets.get(key)
  if (!bucket || bucket.reset < now) {
    _memRateBuckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  bucket.count++
  return bucket.count <= max
}

// ========== Summary cache management ==========

const SUMMARY_KEY_PREFIX = 'takoio:summary:'

interface SummaryCacheEntry {
  key: string
  url: string
  title?: string
  summary: string
  keywords: string[]
  created: number
}

export async function listSummaryCaches (): Promise<SummaryCacheEntry[]> {
  const client = await getRedisClient()
  if (!client) {
    // Memory fallback
    const items: any[] = []
    const now = Date.now()
    for (const [k, v] of _memCache) {
      if (k.startsWith(SUMMARY_KEY_PREFIX) && v.expire > now) {
        items.push({ key: k, ...v.data })
      }
    }
    return items.sort((a, b) => b.created - a.created)
  }

  try {
    const keys: string[] = []
    let cursor = '0'
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', `${SUMMARY_KEY_PREFIX}*`, 'COUNT', 100)
      cursor = next
      keys.push(...batch)
    } while (cursor !== '0')

    if (keys.length === 0) return []

    const values = await client.mget(...keys)
    const items: any[] = []
    for (let i = 0; i < keys.length; i++) {
      if (values[i]) {
        try {
          const data = JSON.parse(values[i]!) as SummaryCacheData
          items.push({ key: keys[i], ...data })
        } catch { /* skip malformed */ }
      }
    }
    return items.sort((a, b) => b.created - a.created)
  } catch (e: any) {
    console.warn('[redis] listSummaryCaches failed:', e.message)
    return []
  }
}

export async function deleteSummaryCacheByUrl (url: string): Promise<number> {
  const urlHash = createHash('md5').update(url).digest('hex')
  const pattern = `${SUMMARY_KEY_PREFIX}${urlHash}:*`
  const client = await getRedisClient()
  if (!client) {
    let count = 0
    for (const k of _memCache.keys()) {
      if (k.startsWith(`${SUMMARY_KEY_PREFIX}${urlHash}:`)) { _memCache.delete(k); count++ }
    }
    return count
  }

  try {
    const keys: string[] = []
    let cursor = '0'
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = next
      keys.push(...batch)
    } while (cursor !== '0')

    if (keys.length === 0) return 0
    await client.del(...keys)
    return keys.length
  } catch (e: any) {
    console.warn('[redis] deleteSummaryCacheByUrl failed:', e.message)
    return 0
  }
}

export async function clearAllSummaryCaches (): Promise<number> {
  const client = await getRedisClient()
  if (!client) {
    let count = 0
    for (const k of _memCache.keys()) {
      if (k.startsWith(SUMMARY_KEY_PREFIX)) { _memCache.delete(k); count++ }
    }
    return count
  }

  try {
    const keys: string[] = []
    let cursor = '0'
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', `${SUMMARY_KEY_PREFIX}*`, 'COUNT', 100)
      cursor = next
      keys.push(...batch)
    } while (cursor !== '0')

    if (keys.length === 0) return 0
    await client.del(...keys)
    return keys.length
  } catch (e: any) {
    console.warn('[redis] clearAllSummaryCaches failed:', e.message)
    return 0
  }
}
