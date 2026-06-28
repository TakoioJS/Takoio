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

async function ensureReady (): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    // initIpSearcher (file I/O) is independent of DB — start in parallel
    const dbPromise = ensureDb()
    initIpSearcher()
    await dbPromise
    await initPassword()
  })()
  return initPromise
}

export async function fetch (request: Request): Promise<Response> {
  await ensureReady()
  return app.fetch(request)
}

export default { fetch }
