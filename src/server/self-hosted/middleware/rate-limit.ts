import { rateLimitStore } from '../store/index'
import { getClientIp } from '../utils/ip'

const THROTTLE_MS = parseInt(process.env.TAKOIO_THROTTLE || '250', 10)

export const rateLimitMiddleware = async (c: any, next: any) => {
  const ip = await getClientIp(c)
  if (!await rateLimitStore.checkRateLimit(ip)) {
    return c.json({ result: { message: '请求过于频繁，请稍后再试' } }, 429)
  }
  if (THROTTLE_MS > 0) await new Promise(r => setTimeout(r, THROTTLE_MS))
  await next()
}
