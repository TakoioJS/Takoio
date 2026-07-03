/**
 * Redis — connection reuse with lazy initialization for serverless compatibility.
 *
 * 设计演进：
 * 1. 早期：每次操作新建连接（彻底避免 serverless 死连接）
 * 2. 现在：lazy connection 单例 + 健康检查（平衡性能与兼容性）
 * 3. 原理：首次使用时建立连接，后续复用；连接异常时自动重建
 *
 * 云函数注意：实例冻结后连接可能失效，通过健康检查自动处理。
 */

import Redis from 'ioredis'
import { createHash } from 'node:crypto'
import { logger } from '../utils/logger'
import { REDIS_URL } from '../env'

const CONNECT_TIMEOUT = 5_000

// ========== Connection Management ==========

let _redisClient: Redis | null = null
let _connecting = false
let _connectPromise: Promise<Redis> | null = null

/** 获取或创建 Redis 连接（lazy + singleton） */
async function getRedisClient (): Promise<Redis | null> {
  const url = REDIS_URL
  if (!url) return null

  // 检查现有连接是否健康
  if (_redisClient) {
    try {
      await _redisClient.ping()
      return _redisClient
    } catch {
      // 连接已失效，关闭并重建
      try { _redisClient.disconnect() } catch { /* ignore */ }
      _redisClient = null
    }
  }

  // 防止并发创建多个连接
  if (_connecting && _connectPromise) {
    return _connectPromise
  }

  _connecting = true
  _connectPromise = new Promise<Redis>((resolve, reject) => {
    const client = new Redis(url, {
      connectTimeout: CONNECT_TIMEOUT,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) return null // 最多重试 2 次
        return Math.min(times * 100, 1000)
      },
    })

    client.on('error', (err) => {
      logger.warn('[redis] connection error:', err.message)
    })

    client.connect()
      .then(() => {
        _redisClient = client
        resolve(client)
      })
      .catch((err) => {
        _connecting = false
        _connectPromise = null
        reject(err)
      })
  })

  return _connectPromise.finally(() => {
    _connecting = false
  })
}

/** 安全关闭 Redis 连接（用于测试或优雅退出） */
export async function closeRedis (): Promise<void> {
  if (_redisClient) {
    try { await _redisClient.quit() } catch { /* ignore */ }
    _redisClient = null
  }
  _connecting = false
  _connectPromise = null
}

// ========== withRedis (Connection Reuse) ==========

/**
 * 在复用连接上执行 Redis 操作。
 * 连接异常时自动降级到内存兜底。
 */
export async function withRedis<T> (fn: (client: Redis) => Promise<T>): Promise<T | null> {
  try {
    const client = await getRedisClient()
    if (!client) return null
    return await fn(client)
  } catch (e: any) {
    // 连接失败时清除缓存，下次会重新连接
    if (_redisClient) {
      try { _redisClient.disconnect() } catch { /* ignore */ }
      _redisClient = null
    }
    _connecting = false
    _connectPromise = null
    return null
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
  protocol?: string
  clientStatus?: string
}

/** 供 /api/health 使用：真实建连 + ping，返回详细状态。 */
export async function getRedisDiagnostics (): Promise<RedisDiagnostics> {
  const url = REDIS_URL
  if (!url) return { urlConfigured: false, status: 'error', error: 'REDIS_URL not set' }

  // 解析 URL 协议（rediss:// vs redis://）— 不泄露密码
  let protocol = 'unknown'
  try { protocol = new URL(url).protocol.replace(':', '') } catch { /* invalid url */ }

  // 独立建连以捕获完整诊断
  const client = new Redis(url, {
    connectTimeout: CONNECT_TIMEOUT,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  })

  let clientStatus = 'initial'
  client.on('error', () => { /* suppress uncaught */ })

  try {
    await client.connect()
    clientStatus = client.status
    const pong = await client.ping()
    if (pong === 'PONG') return { urlConfigured: true, status: 'connected', protocol, clientStatus }
    return { urlConfigured: true, status: 'error', error: `unexpected ping response: ${pong}`, protocol, clientStatus }
  } catch (e: any) {
    clientStatus = client.status
    return { urlConfigured: true, status: 'error', error: formatError(e), protocol, clientStatus }
  } finally {
    client.disconnect()
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

// Memory fallback when Redis is unavailable — LRU with max size
class LRUCache<K, V> {
  private cache = new Map<K, V>()
  constructor (private maxSize: number) {}

  get (key: K): V | undefined {
    const value = this.cache.get(key)
    if (value) {
      // 移动到最新
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set (key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 淘汰最旧的
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  delete (key: K): boolean {
    return this.cache.delete(key)
  }

  has (key: K): boolean {
    return this.cache.has(key)
  }

  keys (): IterableIterator<K> {
    return this.cache.keys()
  }

  get size (): number {
    return this.cache.size
  }
}

const _memCache = new LRUCache<string, { data: SummaryCacheData; expire: number }>(1000)
setInterval(() => {
  const now = Date.now()
  for (const k of _memCache.keys()) {
    const entry = _memCache.get(k)
    if (entry && entry.expire < now) _memCache.delete(k)
  }
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

/** Clean up expired rate-limit buckets to prevent unbounded memory growth. */
function cleanupExpiredRateBuckets (now: number): void {
  for (const [key, bucket] of _memRateBuckets.entries()) {
    if (bucket.reset < now) {
      _memRateBuckets.delete(key)
    }
  }
}

/** 内存限流（serverless 或 Redis 不可用时使用） */
export function memoryRateLimit (identifier: string, max: number, windowMs: number): boolean {
  const key = `takoio:rate:${identifier}`
  const now = Date.now()
  // Periodic cleanup: every 1000 requests, purge expired buckets to prevent leaks.
  if (_memRateBuckets.size % 1000 === 0) {
    cleanupExpiredRateBuckets(now)
  }
  const bucket = _memRateBuckets.get(key)
  if (!bucket || bucket.reset < now) {
    _memRateBuckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  bucket.count++
  return bucket.count <= max
}

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
  return memoryRateLimit(identifier, max, windowMs)
}

// ========== Comment list cache ==========
// 高频读操作（访客打开文章页）缓存，降低 DB 压力。Redis 不可用时走内存 LRU 兜底。

const COMMENT_LIST_TTL = 30 // 30 秒，平衡新鲜度与命中率
const COMMENT_LIST_KEY_PREFIX = 'takoio:comments:'

const commentListCacheKey = (url: string, page: number, pageSize: number, sort: string): string => {
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)
  return `${COMMENT_LIST_KEY_PREFIX}${urlHash}:${page}:${pageSize}:${sort}`
}

// 内存兜底：LRU + url 反向索引（用于按 url 失效）
const _memCommentCache = new LRUCache<string, { data: any; expire: number }>(1000)
const _memCommentUrlIndex = new Map<string, Set<string>>()

/** 清理过期的内存缓存 */
function cleanupMemCommentCache (): void {
  const now = Date.now()
  for (const k of _memCommentCache.keys()) {
    const entry = _memCommentCache.get(k)
    if (entry && entry.expire < now) {
      _memCommentCache.delete(k)
    }
  }
}

setInterval(cleanupMemCommentCache, 60_000).unref()

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

/**
 * Get-or-set 模式：cache miss 时在同一个 withRedis 连接内完成 GET→miss→SET，
 * 避免 cache miss 路径建两次 Redis 连接。
 *
 * @param loader cache miss 时从 DB 加载数据的函数
 * @returns 缓存或新加载的数据
 */
export async function getOrSetCommentListCache (
  url: string, page: number, pageSize: number, sort: string,
  loader: () => Promise<any>
): Promise<any> {
  const key = commentListCacheKey(url, page, pageSize, sort)

  // 先查内存兜底（快速路径，无 Redis 开销）
  const mem = _memCommentCache.get(key)
  if (mem && mem.expire > Date.now()) return mem.data

  // 单次 withRedis 连接内完成 GET → miss → SET
  try {
    const result = await withRedis(async (c) => {
      const raw = await c.get(key)
      if (raw) return JSON.parse(raw)
      // cache miss — 加载并写入
      const data = await loader()
      await c.set(key, JSON.stringify(data), 'EX', COMMENT_LIST_TTL)
      return data
    })
    if (result !== null) return result
  } catch { /* fall through to memory */ }

  // Redis 不可用 — 加载并写入内存
  const data = await loader()
  _memCommentCache.set(key, { data, expire: Date.now() + COMMENT_LIST_TTL * 1000 })
  if (!_memCommentUrlIndex.has(url)) _memCommentUrlIndex.set(url, new Set())
  _memCommentUrlIndex.get(url)!.add(key)
  return data
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
  for (const k of _memCache.keys()) {
    const v = _memCache.get(k)
    if (v && k.startsWith(SUMMARY_KEY_PREFIX) && v.expire > now) {
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
