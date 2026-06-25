/**
 * Extract client IP from request headers.
 *
 * Priority: custom header → standard proxy headers → Node.js socket (self-hosted only).
 * In serverless environments (Vercel, Netlify), there is no Node.js HTTP server,
 * so getConnInfo is skipped and we rely entirely on proxy headers.
 */

import { getConfig } from '../config'

// Headers to check in order of preference (populated by reverse proxies / CDNs)
const PROXY_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-vercel-forwarded-for',
  'fly-client-ip',
] as const

const pickFirstIp = (header: string | undefined): string =>
  header?.split(',')[0]?.trim() || ''

export const getClientIp = async (c: any): Promise<string> => {
  const config = await getConfig()

  // 1. User-configured custom header
  const customHeader = config.IP_PROXY_HEADER?.toLowerCase()
  if (customHeader) {
    const ip = pickFirstIp(c.req.header(customHeader))
    if (ip) return ip
  }

  // 2. Standard proxy headers
  for (const h of PROXY_HEADERS) {
    const ip = pickFirstIp(c.req.header(h))
    if (ip) return ip
  }

  // 3. Node.js socket — only available in self-hosted mode (via @hono/node-server).
  //    Serverless runtimes (Vercel, Netlify) do not expose a real socket,
  //    so we guard with env checks to avoid a useless import + exception.
  if (c.env?.socket || c.env?.incoming) {
    try {
      const { getConnInfo } = await import('@hono/node-server/conninfo')
      const info = getConnInfo(c)
      if (info.remote.address) return info.remote.address
    } catch { /* not in a Node HTTP server context */ }
  }

  return '127.0.0.1'
}
