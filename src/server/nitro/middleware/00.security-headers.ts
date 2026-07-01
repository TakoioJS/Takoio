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
 * - Permissions-Policy — 锁定敏感浏览器 API
 * - Content-Security-Policy — admin panel 用 nonce-based CSP（移除 unsafe-inline）
 */

import { randomBytes } from 'node:crypto'
import { isProd } from '#core/utils/env'

// CSP nonce 通过 event.context 传递给 admin-spa 中间件
// 用类型断言访问，避免 declare module 扩展被 eslint 误报为未使用
interface CspContext { __cspNonce?: string }

export default defineMiddleware((event) => {
  // Prevent clickjacking
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  // Prevent MIME type sniffing
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  // Referrer policy
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  // 锁定敏感浏览器 API
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')

  // HSTS (only in production) — 加 preload 便于提交到 HSTS 预加载列表
  if (isProd()) {
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // Content Security Policy for admin panel — nonce-based，移除 'unsafe-inline' 防 XSS
  const url = getRequestURL(event).pathname
  if (url.startsWith('/admin')) {
    // 每个请求生成独立 nonce（16 字节 base64），存到 context 供 admin-spa 注入到 <script> 标签
    const nonce = randomBytes(16).toString('base64')
    ;(event.context as CspContext).__cspNonce = nonce
    setResponseHeader(
      event,
      'Content-Security-Policy',
      'default-src \'self\'; ' +
      `script-src 'self' 'nonce-${nonce}'; ` +
      'style-src \'self\' \'unsafe-inline\'; ' +
      'img-src \'self\' data: https:; ' +
      'font-src \'self\'; ' +
      'connect-src \'self\' /api; ' +
      'object-src \'none\'; ' +
      'base-uri \'self\'; ' +
      'form-action \'self\'; ' +
      'frame-ancestors \'none\'; ' +
      'worker-src \'self\''
    )
  }
})
