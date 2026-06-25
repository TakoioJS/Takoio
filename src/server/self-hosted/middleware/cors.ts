import { getConfig } from '../config'
import { logger } from '../utils/logger'

let cachedWarn = false

export const corsMiddleware = async (c: any, next: any) => {
  const cfg = await getConfig()
  const origins = (cfg.CORS_ORIGINS || '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
  const origin = c.req.header('origin') || ''

  let allowed = false
  let hasExplicitOrigins = false
  if (origins.includes('*')) {
    allowed = true
    hasExplicitOrigins = true
  } else if (origins.length > 0) {
    allowed = origins.includes(origin)
    hasExplicitOrigins = true
  } else if (origin) {
    // 开发模式：反射 origin 但不设置 credentials
    allowed = true
    if (!cachedWarn) { cachedWarn = true; logger.warn('CORS_ORIGINS 未配置，生产环境请在管理面板中设置允许的域名。当前为开发模式，不发送跨域凭据。') }
  }

  if (allowed && origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin)
    // 仅当用户明确配置了白名单时才发送 credentials
    if (hasExplicitOrigins) {
      c.res.headers.set('Access-Control-Allow-Credentials', 'true')
    }
  }
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  c.res.headers.set('Access-Control-Max-Age', '86400')
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  await next()
}