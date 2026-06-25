import { getConfig } from '../config'
import { logger } from '../utils/logger'

let cachedWarn = false

export const corsMiddleware = async (c: any, next: any) => {
  const cfg = await getConfig()
  const origins = (cfg.CORS_ORIGINS || '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
  const origin = c.req.header('origin') || ''

  let allowed = false
  if (origins.includes('*')) {
    allowed = true
  } else if (origins.length > 0) {
    allowed = origins.includes(origin)
  } else if (origin) {
    allowed = true
    if (!cachedWarn) { cachedWarn = true; logger.warn('CORS_ORIGINS 未配置，建议在管理面板中设置允许的域名') }
  }

  if (allowed && origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    c.res.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  c.res.headers.set('Access-Control-Max-Age', '86400')
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  await next()
}
