/**
 * Security headers middleware — adds essential security headers to all responses.
 *
 * Runs before CORS (00 prefix) to ensure headers are set on all responses.
 *
 * Headers added:
 * - X-Frame-Options: DENY — prevents clickjacking
 * - X-Content-Type-Options: nosniff — prevents MIME type sniffing
 * - Referrer-Policy: strict-origin-when-cross-origin — controls referrer leakage
 * - Strict-Transport-Security — HSTS (production only)
 * - Content-Security-Policy — XSS protection for admin panel
 */

import { isProd } from '#core/utils/env'

export default defineMiddleware((event) => {
  // Prevent clickjacking
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  // Prevent MIME type sniffing
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  // Referrer policy
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS (only in production)
  if (isProd()) {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Content Security Policy for admin panel
  const url = getRequestURL(event).pathname
  if (url.startsWith('/admin')) {
    setResponseHeader(
      event,
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self' /api;"
    )
  }
})
