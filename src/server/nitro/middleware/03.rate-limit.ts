/**
 * Rate limit middleware — per-IP sliding window + optional throttle delay.
 *
 * Response body on 429 MUST remain { result: { message } } to match
 * the old Hono implementation (frontend depends on this shape).
 */

import { rateLimitStore } from '#core'
import { getClientIp } from '#core'
import { isServerless, TAKOIO_THROTTLE_MS } from '#core'
import type { RateLimitAction } from '#core'
import { buildRequestContext } from '../utils/request-context'

// 默认 0：rate-limit 中间件已用精确的滑动窗口限流，无需额外人为延迟。
// 如需防爬可显式设置 TAKOIO_THROTTLE=250（毫秒）。
const THROTTLE_MS = TAKOIO_THROTTLE_MS

// Skip artificial throttle delay on serverless — it wastes billed execution time
const skipThrottle = isServerless()

/** 根据请求方法和路径判断限流 action */
function resolveRateLimitAction (event: any): RateLimitAction {
  const method = event.method
  const path = event.path || event.node?.req?.url || ''
  const pathLower = path.toLowerCase()

  if (pathLower.startsWith('/api/auth')) return 'login'
  if (pathLower.startsWith('/api/admin')) return 'admin'
  if (pathLower.startsWith('/api/upload')) return 'upload'
  if (pathLower.startsWith('/api/reactions')) return 'reaction'
  if (pathLower.startsWith('/api/comments') && method === 'POST') return 'comment'
  return 'default'
}

export default defineMiddleware(async (event) => {
  const ip = await getClientIp(buildRequestContext(event))
  const action = resolveRateLimitAction(event)

  if (!await rateLimitStore.checkRateLimit(ip, action)) {
    // CRITICAL: keep response body identical to old Hono implementation
    setResponseStatus(event, 429)
    return { result: { message: '请求过于频繁，请稍后再试' } }
  }

  if (!skipThrottle && THROTTLE_MS > 0) {
    await new Promise(r => setTimeout(r, THROTTLE_MS))
  }

  // No return = passthrough
})
