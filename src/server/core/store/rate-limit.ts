/**
 * 限流逻辑 — Redis when available, DB persistence for serverless, memory fallback.
 *
 * Layer: Redis (preferred) > DB (serverless/reliable) > Memory (last resort)
 *
 * serverless 环境下 Redis TLS 握手开销大（100-300ms），直接走 DB 持久化限流，
 * 解决多实例独立计数的问题。内存限流作为兜底保留。
 */

import { DB_TYPE, isServerless, getRateLimitConfig } from '../env'
import type { RateLimitAction } from '../constants'

/** Check if Redis rate limiting should be skipped (serverless or Redis unavailable).
 *  Evaluated at runtime, not module-load time, to handle env var timing issues.
 */
export async function shouldSkipRedisRateLimit (): Promise<boolean> {
  try { return isServerless() } catch { return false }
}

/** DB-based rate limit with sliding window.
 *  Uses the underlying Drizzle DB directly for cross-instance persistence.
 *  Falls back to memory limit if DB is unavailable.
 */
export async function _dbRateLimit (key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs

  try {
    let fn: any
    if (DB_TYPE === 'mongodb') {
      fn = (await import('./mongodb')).dbRateLimit
    } else if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql' || DB_TYPE === 'pg') {
      fn = (await import('./postgres')).dbRateLimit
    } else {
      fn = (await import('./sqlite')).dbRateLimit
    }
    if (typeof fn === 'function') {
      return fn(key, maxRequests, windowMs, windowStart)
    }
  } catch {
    // Fall through to memory fallback
  }
  // DB unavailable — fall back to memory limit
  const { memoryRateLimit } = await import('./redis')
  return memoryRateLimit(key, maxRequests, windowMs)
}

export const rateLimitStore = {
  /**
   * 按 action 分桶的滑动窗口限流。
   * @param ip 客户端 IP
   * @param action 限流 action，默认 'default'
   */
  async checkRateLimit (ip: string, action: RateLimitAction = 'default') {
    const config = getRateLimitConfig()[action]
    const key = `${action}:${ip}`
    if (await shouldSkipRedisRateLimit()) {
      return _dbRateLimit(key, config.maxRequests, config.windowMs)
    }
    const { redisRateLimit } = await import('./redis')
    return redisRateLimit(key, config.maxRequests, config.windowMs)
  },
}
