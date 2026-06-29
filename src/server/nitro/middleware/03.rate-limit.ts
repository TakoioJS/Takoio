/**
 * Rate limit middleware — per-IP sliding window + optional throttle delay.
 *
 * Response body on 429 MUST remain { result: { message } } to match
 * the old Hono implementation (frontend depends on this shape).
 */

import { rateLimitStore } from '#core/store/index'
import { getClientIp } from '#core/utils/ip'

const THROTTLE_MS = parseInt(process.env.TAKOIO_THROTTLE || '250', 10)

// Skip artificial throttle delay on serverless — it wastes billed execution time
function isServerlessPreset (): boolean {
  const preset = (process.env.NITRO_PRESET || (import.meta as any).env?.PRESET || '').toLowerCase()
  return preset === 'vercel' || preset === 'netlify' || preset === 'cloudflare'
}

const skipThrottle = isServerlessPreset()

export default defineMiddleware(async (event) => {
  const ip = await getClientIp(event)

  if (!await rateLimitStore.checkRateLimit(ip)) {
    // CRITICAL: keep response body identical to old Hono implementation
    setResponseStatus(event, 429)
    return { result: { message: '请求过于频繁，请稍后再试' } }
  }

  if (!skipThrottle && THROTTLE_MS > 0) {
    await new Promise(r => setTimeout(r, THROTTLE_MS))
  }

  // No return = passthrough
})
