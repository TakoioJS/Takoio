/**
 * Extract client IP from request headers.
 *
 * Security: only reads proxy headers when the direct connection IP
 * falls within TRUSTED_PROXIES. If no trusted proxies configured,
 * only the direct socket IP is used (no header forging possible).
 *
 * Migrated from Hono → H3 → RequestContext port.
 * The direct socket IP is now provided by the nitro adapter
 * (buildRequestContext → getRequestIP(event, { xForwardedFor: false }));
 * core is fully framework-agnostic.
 */

import { getConfig } from '../config'
import type { RequestContext } from '../ports'

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

export const getClientIp = async (ctx: RequestContext): Promise<string> => {
  const config = await getConfig()

  // Direct connection IP is extracted by the nitro adapter (from socket,
  // NOT from X-Forwarded-For — preserves the original security guarantee).
  const directIp = ctx.ip || '127.0.0.1'

  // Parse trusted proxies
  const trustedRaw = config.TRUSTED_PROXIES || ''
  const trustedList = trustedRaw.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)

  // Only read proxy headers if the direct IP is from a trusted proxy
  const isTrusted = isTrustedProxy(directIp, trustedList)

  // 1. User-configured custom header (only when trusted)
  if (isTrusted) {
    const customHeader = config.IP_PROXY_HEADER?.toLowerCase()
    if (customHeader) {
      const ip = pickFirstIp(ctx.headers[customHeader])
      if (ip) return ip
    }

    // 2. Standard proxy headers (only when trusted)
    for (const h of PROXY_HEADERS) {
      const ip = pickFirstIp(ctx.headers[h])
      if (ip) return ip
    }
  }

  // 3. Return the direct connection IP
  return directIp
}
