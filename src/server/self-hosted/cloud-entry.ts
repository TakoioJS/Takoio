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
 */

import { app } from './app'
import { ensureDb } from './store/index'
import { initPassword } from './auth'
import { initIpSearcher } from './ip-region'

let initialized = false

async function ensureReady () {
  if (initialized) return
  await ensureDb()
  await initPassword()
  initIpSearcher()
  initialized = true
}

export async function fetch (request: Request, env?: Record<string, string>) {
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      if (process.env[k] === undefined) (process.env as any)[k] = v
    }
  }
  await ensureReady()
  return app.fetch(request)
}

export default { fetch }