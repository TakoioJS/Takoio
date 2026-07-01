/**
 * Admin SPA fallback — serves index.html for extensionless /admin/* paths.
 *
 * Nitro's publicAssets handles actual files (JS/CSS/images).
 * This middleware provides vue-router history mode fallback.
 *
 * Must run FIRST (01 prefix) — short-circuits /admin paths before
 * other middleware (CORS, rate-limit) touch them.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Candidate directories for the admin build output.
// process.cwd() under nitro dev/build is src/server/
const candidates = [
  join(process.cwd(), 'admin-dist'),         // Docker deployment
  join(process.cwd(), '../../dist/admin'),    // CI build (vite outDir relative to src/server)
  join(process.cwd(), 'src/admin/dist'),      // Alternate dev path
  join(process.cwd(), '.vercel/output/static/admin'), // Vercel serverless static output
  join(process.cwd(), 'static/admin'),        // Vercel static fallback
]
const adminDistDir = candidates.find(p => existsSync(p))

export default defineMiddleware((event) => {
  const url = getRequestURL(event).pathname

  // Only handle /admin paths — never intercept /api
  if (!url.startsWith('/admin')) return

  // Extension paths (JS/CSS/images) are handled by publicAssets — skip
  if (/\.\w+$/.test(url)) return

  // SPA fallback: return index.html for vue-router history mode
  if (adminDistDir) {
    setResponseHeader(event, 'Content-Type', 'text/html')
    let html = readFileSync(join(adminDistDir, 'index.html'), 'utf-8')
    // 注入 CSP nonce 到所有 <script> 标签（00.security-headers 已生成 nonce 存到 context）
    // 这样 CSP script-src 'nonce-xxx' 才能放行内联/外部 script
    const nonce = (event.context as { __cspNonce?: string }).__cspNonce
    if (nonce) {
      html = html.replace(/<script(\s)/g, `<script nonce="${nonce}"$1`)
    }
    return html
  }
  // adminDistDir not found (not built yet) — fall through to 404
})
