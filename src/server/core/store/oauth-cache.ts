/**
 * OAuth cache — Redis-backed with in-memory LRU fallback.
 *
 * Stores:
 *   - OAuth state tokens (CSRF protection):   takoio:oauth:state:{state}
 *   - Email verification codes:               takoio:oauth:email-code:{uuid}
 *
 * Default TTL: 5 minutes (300_000ms). Memory LRU fallback ensures availability
 * in serverless or Redis-down scenarios. LRU size: 1000, auto-cleanup every 60s.
 *
 * Reuses the connection pattern (withRedis) from ./redis.ts; the LRUCache class
 * is duplicated locally because it is not exported from redis.ts.
 */

import { withRedis } from './redis'
import { LRUCache } from '../utils/lru-cache'
import { logger } from '../utils/logger'
import type { AuthUser } from '../auth-social'

const DEFAULT_TTL_MS = 300_000
const LRU_MAX_SIZE = 1000
const CLEANUP_INTERVAL_MS = 60_000

const stateKey = (state: string): string => `takoio:oauth:state:${state}`
const verifyCodeKey = (uuid: string): string => `takoio:oauth:email-code:${uuid}`

interface MemEntry<V> {
  value: V
  expire: number
}

const _memStateCache = new LRUCache<string, MemEntry<true>>(LRU_MAX_SIZE)
const _memCodeCache = new LRUCache<string, MemEntry<{ code: string; user: AuthUser }>>(LRU_MAX_SIZE)

let _warnedRedisUnavailable = false

function warnRedisUnavailable (): void {
  if (_warnedRedisUnavailable) return
  _warnedRedisUnavailable = true
  logger.warn('[oauth-cache] Redis unavailable, using memory LRU')
}

// Periodic cleanup of expired entries (every 60s). unref() so it never blocks process exit.
setInterval(() => {
  const now = Date.now()
  for (const k of _memStateCache.keys()) {
    const entry = _memStateCache.get(k)
    if (entry && entry.expire < now) _memStateCache.delete(k)
  }
  for (const k of _memCodeCache.keys()) {
    const entry = _memCodeCache.get(k)
    if (entry && entry.expire < now) _memCodeCache.delete(k)
  }
}, CLEANUP_INTERVAL_MS).unref()

// ========== State ==========

export async function setState (state: string, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
  const key = stateKey(state)
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  try {
    const done = await withRedis(async (c) => {
      await c.set(key, JSON.stringify(true), 'EX', ttlSeconds)
      return true
    })
    if (done) return
  } catch { /* fall through to memory */ }
  warnRedisUnavailable()
  _memStateCache.set(key, { value: true, expire: Date.now() + ttlMs })
}

export async function getState (state: string): Promise<boolean> {
  const key = stateKey(state)
  try {
    const found = await withRedis<boolean>(async (c) => (await c.get(key)) !== null)
    if (found === true) return true
    // Not found in Redis (or Redis unavailable) — fall through to memory
  } catch { /* fall through to memory */ }
  const mem = _memStateCache.get(key)
  return !!(mem && mem.expire > Date.now())
}

export async function consumeState (state: string): Promise<boolean> {
  const key = stateKey(state)
  try {
    const consumed = await withRedis<boolean>(async (c) => {
      const raw = await c.get(key)
      if (raw === null) return false
      await c.del(key)
      return true
    })
    if (consumed === true) return true
    // Not found in Redis (or Redis unavailable) — fall through to memory
  } catch { /* fall through to memory */ }
  const mem = _memStateCache.get(key)
  if (mem && mem.expire > Date.now()) {
    _memStateCache.delete(key)
    return true
  }
  return false
}

// ========== Verify code ==========

export async function setVerifyCode (
  uuid: string,
  code: string,
  user: AuthUser,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const key = verifyCodeKey(uuid)
  const value = { code, user }
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))
  try {
    const done = await withRedis(async (c) => {
      await c.set(key, JSON.stringify(value), 'EX', ttlSeconds)
      return true
    })
    if (done) return
  } catch { /* fall through to memory */ }
  warnRedisUnavailable()
  _memCodeCache.set(key, { value, expire: Date.now() + ttlMs })
}

export async function consumeVerifyCode (uuid: string, code: string): Promise<AuthUser | null> {
  const key = verifyCodeKey(uuid)
  try {
    const matched = await withRedis<AuthUser | false>(async (c) => {
      const raw = await c.get(key)
      if (raw === null) return false
      const parsed = JSON.parse(raw) as { code: string; user: AuthUser }
      if (parsed.code !== code) return false
      await c.del(key)
      return parsed.user
    })
    if (matched !== null && matched !== false) return matched
    // Not matched in Redis (or Redis unavailable) — fall through to memory
  } catch { /* fall through to memory */ }
  const mem = _memCodeCache.get(key)
  if (mem && mem.expire > Date.now() && mem.value.code === code) {
    _memCodeCache.delete(key)
    return mem.value.user
  }
  return null
}
