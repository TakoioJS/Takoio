/**
 * Redis — per-invocation connection model for serverless.
 *
 * 云函数哲学：每次调用独立、无状态。不再维护模块级单例连接，
 * 而是通过 withRedis() 在每次操作时建连、用完即弃。这彻底避免了
 * Vercel 等平台冻结实例后 TCP 连接被杀导致的"死连接"问题。
 *
 * Redis 不可用时所有功能自动降级到内存兜底。
 */

import Redis from 'ioredis'
import { logger } from '../utils/logger'
import { createHash } from 'node:crypto'

const CONNECT_TIMEOUT = 5_000

/**
 * Per-invocation Redis 执行器。
 * 建立 → 执行 fn → 关闭，全程无状态。
 *
 * @returns fn 的返回值；未配置 REDIS_URL 时返回 null。
 * @throws 连接失败或 fn 抛出时 throw（调用方用 try/catch 走兜底）。
 */
export async function withRedis<T> (fn: (client: Redis) => Promise<T>): Promise<T | null> {
  const url = process.env.REDIS_URL
  if (!url) return null

  const client = new Redis(url, {
    connectTimeout: CONNECT_TIMEOUT,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  })
  try {
    await client.connect()
    return await fn(client)
  } finally {
    client.disconnect()
  }
}

function formatError (e: any): string {
  if (!e) return 'unknown error'
  const parts: string[] = []
  if (e.constructor?.name) parts.push(`[${e.constructor.name}]`)
  if (e.code) parts.push(`code=${e.code}`)
  if (e.errno) parts.push(`errno=${e.errno}`)
  if (e.address) parts.push(`address=${e.address}`)
  if (e.port) parts.push(`port=${e.port}`)
  if (e.message) parts.push(`msg=${e.message}`)
  return parts.join(' ') || String(e)
}

// ========== Diagnostics ==========

export interface RedisDiagnostics {
  urlConfigured: boolean
  status: 'connected' | 'error'
  error?: string
}

/** 供 /api/health 使用：真实建连 + ping，返回详细状态。 */
export async function getRedisDiagnostics (): Promise<RedisDiagnostics> {
  const url = process.env.REDIS_URL
  if (!url) return { urlConfigured: false, status: 'error', error: 'REDIS_URL not set' }
  try {
    const ok = await withRedis(async (c) => (await c.ping()) === 'PONG')
    if (ok === true) return { urlConfigured: true, status: 'connected' }
    return { urlConfigured: true, status: 'error', error: 'unexpected ping response' }
  } catch (e: any) {
    return { urlConfigured: true, status: 'error', error: formatError(e) }
  }
}

/** Redis 是否可用（每次真实检测，无缓存——符合无状态原则）。 */
export async function isRedisAvailable (): Promise<boolean> {
  try {
    const ok = await withRedis(async (c) => (await c.ping()) === 'PONG')
    return ok === true
  } catch {
    return false
  }
}

// ========== Summary cache ==========

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
    const hit = await withRedis(async (c) => {
      const raw = await c.get(key)
      return raw ? JSON.parse(raw) as SummaryCacheData : null
    })
    if (hit) return hit
  } catch { /* fall through to memory */ }
  const mem = _memCache.get(key)
  if (mem && mem.expire > Date.now()) return mem.data
  return null
}

export async function setSummaryCache (url: string, content: string, data: SummaryCacheData): Promise<void> {
  const key = summaryCacheKey(url, content)
  const payload = JSON.stringify(data)
  try {
    const done = await withRedis(async (c) => { await c.set(key, payload, 'EX', SUMMARY_TTL); return true })
    if (done) return
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
    const result = await withRedis(async (c) => {
      const count = await c.incr(key)
      if (count === 1) await c.pexpire(key, windowMs)
      return count
    })
    if (result !== null) return result <= max
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
    const hit = await withRedis(async (c) => {
      const raw = await c.get(key)
      return raw ? JSON.parse(raw) : null
    })
    if (hit) return hit
  } catch { /* fall through to memory */ }
  const mem = _memCommentCache.get(key)
  if (mem && mem.expire > Date.now()) return mem.data
  return null
}

export async function setCommentListCache (url: string, page: number, pageSize: number, sort: string, data: any): Promise<void> {
  const key = commentListCacheKey(url, page, pageSize, sort)
  try {
    const done = await withRedis(async (c) => { await c.set(key, JSON.stringify(data), 'EX', COMMENT_LIST_TTL); return true })
    if (done) return
  } catch { /* fall through to memory */ }
  _memCommentCache.set(key, { data, expire: Date.now() + COMMENT_LIST_TTL * 1000 })
  if (!_memCommentUrlIndex.has(url)) _memCommentUrlIndex.set(url, new Set())
  _memCommentUrlIndex.get(url)!.add(key)
}

/** 按 url 失效该文章的所有评论列表缓存（提交/删除/状态变更时调用） */
export async function invalidateCommentListCache (url: string): Promise<void> {
  // Redis: SCAN + DEL
  try {
    await withRedis(async (c) => {
      const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
      const pattern = `${COMMENT_LIST_KEY_PREFIX}${urlHash}:*`
      const keys: string[] = []
      let cursor = '0'
      do {
        const [next, batch] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length > 0) await c.del(...keys)
      return true
    })
  } catch { /* ignore */ }
  // 内存兜底：通过反向索引精确删除
  const keys = _memCommentUrlIndex.get(url)
  if (keys) {
    for (const k of keys) _memCommentCache.delete(k)
    _memCommentUrlIndex.delete(url)
  }
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
  try {
    const result = await withRedis(async (c) => {
      const keys: string[] = []
      let cursor = '0'
      do {
        const [next, batch] = await c.scan(cursor, 'MATCH', `${SUMMARY_KEY_PREFIX}*`, 'COUNT', 100)
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length === 0) return [] as SummaryCacheEntry[]
      const values = await c.mget(...keys)
      const items: SummaryCacheEntry[] = []
      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          try {
            const data = JSON.parse(values[i]!) as SummaryCacheData
            items.push({ key: keys[i], ...data })
          } catch { /* skip malformed */ }
        }
      }
      return items.sort((a, b) => b.created - a.created)
    })
    if (result) return result
  } catch (e: any) {
    logger.warn('[redis] listSummaryCaches failed:', e.message)
  }
  // Memory fallback
  const items: SummaryCacheEntry[] = []
  const now = Date.now()
  for (const [k, v] of _memCache) {
    if (k.startsWith(SUMMARY_KEY_PREFIX) && v.expire > now) {
      items.push({ key: k, ...v.data })
    }
  }
  return items.sort((a, b) => b.created - a.created)
}

export async function deleteSummaryCacheByUrl (url: string): Promise<number> {
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  const pattern = `${SUMMARY_KEY_PREFIX}${urlHash}:*`
  try {
    const result = await withRedis(async (c) => {
      const keys: string[] = []
      let cursor = '0'
      do {
        const [next, batch] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length === 0) return 0
      await c.del(...keys)
      return keys.length
    })
    if (result !== null) return result
  } catch (e: any) {
    logger.warn('[redis] deleteSummaryCacheByUrl failed:', e.message)
  }
  // Memory fallback
  let count = 0
  for (const k of _memCache.keys()) {
    if (k.startsWith(`${SUMMARY_KEY_PREFIX}${urlHash}:`)) { _memCache.delete(k); count++ }
  }
  return count
}

export async function clearAllSummaryCaches (): Promise<number> {
  try {
    const result = await withRedis(async (c) => {
      const keys: string[] = []
      let cursor = '0'
      do {
        const [next, batch] = await c.scan(cursor, 'MATCH', `${SUMMARY_KEY_PREFIX}*`, 'COUNT', 100)
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length === 0) return 0
      await c.del(...keys)
      return keys.length
    })
    if (result !== null) return result
  } catch (e: any) {
    logger.warn('[redis] clearAllSummaryCaches failed:', e.message)
  }
  // Memory fallback
  let count = 0
  for (const k of _memCache.keys()) {
    if (k.startsWith(SUMMARY_KEY_PREFIX)) { _memCache.delete(k); count++ }
  }
  return count
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

  try {
    const result = await withRedis(async (c) => {
      const raw = await c.get(key)
      if (!raw) return false
      const existing = JSON.parse(raw) as SummaryCacheData
      const merged: SummaryCacheData = {
        ...existing,
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.keywords !== undefined ? { keywords: patch.keywords } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
      }
      await c.set(key, JSON.stringify(merged), 'EX', SUMMARY_TTL)
      return true
    })
    if (result !== null) return result
  } catch (e: any) {
    logger.warn('[redis] updateSummaryCache failed:', e.message)
    return false
  }
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
