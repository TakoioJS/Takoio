/**
 * CORS middleware — controls cross-origin access.
 *
 * Modes:
 * 1. Wildcard (*): returns Access-Control-Allow-Origin: *, NO credentials
 *    (per CORS spec, wildcard + credentials is invalid and insecure)
 * 2. Explicit whitelist: reflects matching origin, sends credentials
 * 3. Dev mode (no CORS_ORIGINS): reflects any origin, no credentials (warns once)
 */

import { getConfig } from '#core/config'
import { logger } from '#core/utils/logger'
import { isDev } from '#core/env'

let cachedWarn = false

/** Parse CORS_ORIGINS config which may be a comma-separated string or an array. */
const parseOrigins = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean)
  return String(value || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

export default defineMiddleware(async (event) => {
  const cfg = await getConfig(event)
  const origins = parseOrigins(cfg.CORS_ORIGINS)
  const origin = getRequestHeader(event, 'origin') || ''

  let allowed = false
  let isWildcard = false
  let hasExplicitOrigins = false

  if (origins.includes('*')) {
    allowed = true
    isWildcard = true
  } else if (origins.length > 0) {
    allowed = origins.includes(origin)
    hasExplicitOrigins = true
  } else if (origin && isDev()) {
    // Dev mode only: reflect origin but don't send credentials
    allowed = true
    if (!cachedWarn) {
      cachedWarn = true
      logger.warn('CORS_ORIGINS 未配置，生产环境请在管理面板中设置允许的域名。当前为开发模式，不发送跨域凭据。')
    }
  }

  if (allowed) {
    if (isWildcard) {
      // Wildcard mode: use literal * header, do NOT send credentials
      // (spec: ACAC: true + ACAO: * is rejected by browsers)
      setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    } else if (origin) {
      // Explicit whitelist or dev mode: reflect origin
      setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
      // Only send credentials when user has explicitly configured (non-wildcard) origins
      if (hasExplicitOrigins) {
        setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
      }
    }
  }

  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
  setResponseHeader(event, 'Access-Control-Max-Age', '86400')

  // Preflight: return 204 immediately
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  // Non-OPTIONS: no return = passthrough to next middleware/handler
})
