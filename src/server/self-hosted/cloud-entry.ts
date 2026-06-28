/**
 * Cloud / Serverless entry — exports `fetch` handler with lazy initialization.
 *
 * Suitable for Vercel, Netlify, AWS Lambda, Tencent SCF, etc.
 * No HTTP server start — just pass the fetch handler to your cloud platform.
 *
 * Usage:
 *   import { fetch } from './cloud-entry'
 *   export const GET = fetch   // Vercel
 *   export const POST = fetch  // Vercel
 *   export default { fetch }   // Netlify
 *
 * Serverless constraints (by design, no fix needed):
 *   - In-memory state (rate limits, login attempts, config/auth hash cache)
 *     is per-instance and resets on cold start. Not shared across instances.
 *   - Session cleanup is handled by MongoDB TTL index (24h) or SQLite backend's
 *     self-contained setInterval (with .unref()). No timer in this file.
 *   - Security controls (rate limits, brute-force protection) are per-instance only.
 *     For multi-instance deployments, use a platform-level WAF or reverse proxy.
 */

import { app } from './app'
import { ensureDb } from './store/index'
import { initPassword } from './auth'
import { initIpSearcher } from './ip-region'

let initPromise: Promise<void> | null = null
let initError: { message: string; stack?: string } | null = null

async function ensureReady (): Promise<void> {
  if (initError) throw initError
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      // initIpSearcher (file I/O) is independent of DB — start in parallel
      const dbPromise = ensureDb()
      initIpSearcher()
      await dbPromise
      await initPassword()
    } catch (e: any) {
      initError = { message: e?.message || String(e), stack: e?.stack }
      // Allow retry on next cold start by clearing the promise
      initPromise = null
      throw e
    }
  })()
  return initPromise
}

/** Lightweight health check that does NOT require DB initialization.
 *  Returns env var status so deployment issues can be diagnosed. */
function healthResponse (request: Request): Response | null {
  const url = new URL(request.url)
  if (url.pathname !== '/api/health') return null
  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase()
  const diag: Record<string, any> = {
    status: 'ok',
    runtime: 'serverless',
    dbType,
    mongoUri: !!process.env.MONGODB_URI,
    libsqlUrl: !!process.env.LIBSQL_URL,
    vercel: !!process.env.VERCEL,
  }
  if (initError) {
    diag.status = 'init_failed'
    diag.error = initError.message
    return new Response(
      JSON.stringify(diag),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return new Response(
    JSON.stringify(diag),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

export async function fetch (request: Request): Promise<Response> {
  // Fast path: health check works without DB
  const health = healthResponse(request)
  if (health) return health

  try {
    await ensureReady()
  } catch (e: any) {
    // Return the actual error so the user can see what's wrong
    console.error('[cloud-entry] init failed:', e?.message, e?.stack)
    return new Response(
      JSON.stringify({
        message: '服务器初始化失败',
        error: e?.message || String(e),
        hint: process.env.DB_TYPE === 'mongodb'
          ? '检查 MONGODB_URI 环境变量是否正确配置'
          : 'Serverless 环境不支持 SQLite，请在 Vercel 项目设置中配置 DB_TYPE=mongodb 和 MONGODB_URI',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  return app.fetch(request)
}

export default { fetch }
