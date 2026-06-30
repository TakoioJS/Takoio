/**
 * Extract client IP from request headers.
 *
 * Security: only reads proxy headers when the direct connection IP
 * falls within TRUSTED_PROXIES. If no trusted proxies configured,
 * only the direct socket IP is used (no header forging possible).
 *
 * Migrated from Hono: replaced @hono/node-server/conninfo with
 * H3's getRequestIP + getRequestHeader.
 */

import { getRequestHeader, getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { getConfig } from '../config'

// Headers to check in order of preference
const PROXY_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-vercel-forwarded-for',
  'fly-client-ip',
] as const

const pickFirstIp = (header: string | undefined): string =>
  header?.split(',')[0]?.trim() || ''

/** Check if an IP is in the trusted proxy list */
const isTrustedProxy = (ip: string, trusted: string[]): boolean =>
  trusted.length === 0 ? false : trusted.includes(ip)

export const getClientIp = async (event: H3Event): Promise<string> => {
  const config = await getConfig(event)

  // Determine the direct connection IP (the actual remote address)
  // H3's getRequestIP: in Node.js reads from socket, in serverless reads from headers
  const directIp = getRequestIP(event, { xForwardedFor: false }) || '127.0.0.1'

  // Parse trusted proxies
  const trustedRaw = config.TRUSTED_PROXIES || ''
  const trustedList = trustedRaw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)

  // Only read proxy headers if the direct IP is from a trusted proxy
  const isTrusted = isTrustedProxy(directIp, trustedList)

  // 1. User-configured custom header (only when trusted)
  if (isTrusted) {
    const customHeader = config.IP_PROXY_HEADER?.toLowerCase()
    if (customHeader) {
      const ip = pickFirstIp(getRequestHeader(event, customHeader))
      if (ip) return ip
    }

    // 2. Standard proxy headers (only when trusted)
    for (const h of PROXY_HEADERS) {
      const ip = pickFirstIp(getRequestHeader(event, h))
      if (ip) return ip
    }
  }

  // 3. Return the direct connection IP
  return directIp
}
