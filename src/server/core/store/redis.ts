/**
 * Redis client singleton — AI summary caching and rate limiting
 *
 * Uses ioredis with config from REDIS_URL environment variable.
 * Falls back gracefully when Redis is unavailable.
 */

import Redis from 'ioredis'
import { logger } from '../utils/logger'

let _client: Redis | null = null
let _connectPromise: Promise<Redis | null> | null = null

/**
 * Get or create a Redis client singleton.
 * Returns null if Redis is not configured or connection fails.
 *
 * 不依赖 isDev() 判断：云函数平台(腾讯SCF/CloudBase 等)可能注入 NODE_ENV=development，
 * 导致 import.meta.dev 在运行时 polyfill 为 true，误判为 dev 模式而跳过 Redis 连接。
 * 改为直接检查 REDIS_URL：设置了就连接，没设置就走内存兜底。
 */
export async function getRedisClient (): Promise<Redis | null> {
  if (_client?.status === 'ready') return _client

  if (_connectPromise) return _connectPromise

  _connectPromise = (async () => {
    try {
      const url = process.env.REDIS_URL
      if (!url) {
        // 未配置 REDIS_URL，走内存兜底
        return null
      }

      _client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy (times) {
          if (times > 3) {
            logger.warn('[redis] Max retry attempts reached, giving up')
            return null // stop retrying
          }
          return Math.min(times * 500, 3000)
        },
        lazyConnect: true,
        connectTimeout: 5000,
      })

      _client.on('error', (err) => {
        logger.warn('[redis] Connection error:', err.message)
      })

      _client.on('ready', () => {
        logger.info('[redis] Connected successfully')
      })

      await _client.connect()
      return _client
    } catch (e: any) {
      logger.warn('[redis] Failed to connect:', e.message)
      _client = null
      _connectPromise = null
      return null
    }
  })()

  return _connectPromise
}

/**
 * Check if Redis is available (cached 30s to avoid ping on every call)
 */
let _redisAvailCache: { ok: boolean; expire: number } | null = null
const REDIS_AVAIL_CACHE_TTL = 30_000 // 30 秒

export async function isRedisAvailable (): Promise<boolean> {
  if (_redisAvailCache && _redisAvailCache.expire > Date.now()) return _redisAvailCache.ok
  try {
    const client = await getRedisClient()
    if (!client) {
      _redisAvailCache = { ok: false, expire: Date.now() + REDIS_AVAIL_CACHE_TTL }
      return false
    }
    await client.ping()
    _redisAvailCache = { ok: true, expire: Date.now() + REDIS_AVAIL_CACHE_TTL }
    return true
  } catch {
    // 失败时立即标记不可用，但短 TTL 以便恢复后快速重试
    _redisAvailCache = { ok: false, expire: Date.now() + 5_000 }
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
  `takoio:summary:${createHash('sha256').update(url).digest('hex').slice(0, 16)}:${createHash('sha256').update(content).digest('hex').slice(0, 16)}`

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
  windowMs: number
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

// ========== Comment list cache ==========
// 高频读操作（访客打开文章页）缓存，降低 DB 压力。Redis 不可用时走内存 LRU 兜底。

const COMMENT_LIST_TTL = 30 // 30 秒，平衡新鲜度与命中率
const COMMENT_LIST_KEY_PREFIX = 'takoio:comments:'

const commentListCacheKey = (url: string, page: number, pageSize: number, sort: string): string => {
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  return `${COMMENT_LIST_KEY_PREFIX}${urlHash}:${page}:${pageSize}:${sort}`
}

// 内存兜底：Map + url 反向索引（用于按 url 失效）
const _memCommentCache = new Map<string, { data: any; expire: number }>()
const _memCommentUrlIndex = new Map<string, Set<string>>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of _memCommentCache) {
    if (v.expire < now) {
      _memCommentCache.delete(k)
      // 反向索引项稍后由 invalidate 或下次 set 时自然清理
    }
  }
}, 60_000).unref()

export async function getCommentListCache (url: string, page: number, pageSize: number, sort: string): Promise<any | null> {
  const key = commentListCacheKey(url, page, pageSize, sort)
  try {
    const client = await getRedisClient()
    if (client) {
      const raw = await client.get(key)
      if (raw) return JSON.parse(raw)
    }
  } catch { /* fall through to memory */ }
  const mem = _memCommentCache.get(key)
  if (mem && mem.expire > Date.now()) return mem.data
  return null
}

export async function setCommentListCache (url: string, page: number, pageSize: number, sort: string, data: any): Promise<void> {
  const key = commentListCacheKey(url, page, pageSize, sort)
  try {
    const client = await getRedisClient()
    if (client) {
      await client.set(key, JSON.stringify(data), 'EX', COMMENT_LIST_TTL)
      return
    }
  } catch { /* fall through to memory */ }
  _memCommentCache.set(key, { data, expire: Date.now() + COMMENT_LIST_TTL * 1000 })
  if (!_memCommentUrlIndex.has(url)) _memCommentUrlIndex.set(url, new Set())
  _memCommentUrlIndex.get(url)!.add(key)
}

/** 按 url 失效该文章的所有评论列表缓存（提交/删除/状态变更时调用） */
export async function invalidateCommentListCache (url: string): Promise<void> {
  // Redis: SCAN + DEL
  try {
    const client = await getRedisClient()
    if (client) {
      const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
      const pattern = `${COMMENT_LIST_KEY_PREFIX}${urlHash}:*`
      const keys: string[] = []
      let cursor = '0'
      do {
        const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length > 0) await client.del(...keys)
    }
  } catch { /* ignore */ }
  // 内存兜底：通过反向索引精确删除
  const keys = _memCommentUrlIndex.get(url)
  if (keys) {
    for (const k of keys) _memCommentCache.delete(k)
    _memCommentUrlIndex.delete(url)
  }
}

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
    logger.warn('[redis] listSummaryCaches failed:', e.message)
    return []
  }
}

export async function deleteSummaryCacheByUrl (url: string): Promise<number> {
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
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
    logger.warn('[redis] deleteSummaryCacheByUrl failed:', e.message)
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
    logger.warn('[redis] clearAllSummaryCaches failed:', e.message)
    return 0
  }
}

/**
 * 按 key 更新摘要缓存（用于后台编辑摘要内容/标签/标题）。
 * 合并 patch：summary/keywords/title 覆盖，url/created 保留；TTL 重置为 30 天。
 * 返回 true 表示更新成功；false 表示 key 不存在/已过期/非法。
 */
export async function updateSummaryCache (
  key: string,
  patch: { summary?: string; keywords?: string[]; title?: string }
): Promise<boolean> {
  // 防 key 越权：必须为摘要缓存 key，且符合严格格式
  if (!key || !/^takoio:summary:[a-f0-9]{32}:[a-f0-9]{16}$/.test(key)) return false

  const client = await getRedisClient()
  if (!client) {
    // 内存分支：保留原 expire
    const existing = _memCache.get(key)
    if (!existing || existing.expire <= Date.now()) return false
    const merged: SummaryCacheData = {
      ...existing.data,
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.keywords !== undefined ? { keywords: patch.keywords } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
    }
    _memCache.set(key, { data: merged, expire: existing.expire })
    return true
  }

  try {
    const raw = await client.get(key)
    if (!raw) return false
    const existing = JSON.parse(raw) as SummaryCacheData
    const merged: SummaryCacheData = {
      ...existing,
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.keywords !== undefined ? { keywords: patch.keywords } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
    }
    await client.set(key, JSON.stringify(merged), 'EX', SUMMARY_TTL)
    return true
  } catch (e: any) {
    logger.warn('[redis] updateSummaryCache failed:', e.message)
    return false
  }
}
