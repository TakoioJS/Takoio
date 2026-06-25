/**
 * Extract client IP from request headers
 */

import { getConnInfo } from '@hono/node-server/conninfo'
import { getConfig } from '../config'

export const getClientIp = async (c: any): Promise<string> => {
  const config = await getConfig()
  const customHeader = config.IP_PROXY_HEADER?.toLowerCase()
  
  let ip = ''
  if (customHeader) {
    ip = c.req.header(customHeader)?.split(',')[0]?.trim()
  }

  if (!ip) {
    ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || c.req.header('cf-connecting-ip')
  }

  if (!ip) {
    try {
      const info = getConnInfo(c)
      ip = info.remote.address
    } catch {}
  }
  const raw = c.env?.incoming || c.env?.req
  return ip || raw?.socket?.remoteAddress || '127.0.0.1'
}
