/**
 * 限流逻辑 — Redis when available, memory fallback.
 *
 * serverless 环境下 Redis TLS 握手开销大，直接走内存限流。
 *
 * **约束**：当部署在多实例 Serverless 环境且未启用 Redis 时，
 * per-IP 限流会退化为 per-instance，各实例独立计数。
 * 敏感入口需依赖 CAPTCHA 或单实例部署保证限流精度。
 */

import { isServerless, getRateLimitConfig } from '../env'
import type { RateLimitAction } from '../constants'

export const rateLimitStore = {
  /**
   * 按 action 分桶的滑动窗口限流。
   * @param ip 客户端 IP
   * @param action 限流 action，默认 'default'
   */
  async checkRateLimit (ip: string, action: RateLimitAction = 'default') {
    const config = getRateLimitConfig()[action]
    const key = `${action}:${ip}`
    if (isServerless()) {
      const { memoryRateLimit } = await import('./redis')
      return memoryRateLimit(key, config.maxRequests, config.windowMs)
    }
    const { redisRateLimit } = await import('./redis')
    return redisRateLimit(key, config.maxRequests, config.windowMs)
  },
}
