/**
 * Takoio Self-Hosted Server — entry point
 *
 * All logic lives in:
 *   - app.ts       — Hono app definition (middleware + routes)
 *   - handlers/    — event handlers (comment, admin, counter, image, import-export)
 *   - middleware/   — CORS, rate-limit, admin-auth
 *   - config.ts    — config management + masking
 *   - auth.ts      — password hashing + brute-force + CAPTCHA + admin auth
 *   - ip-region.ts — IP region lookup
 */

import { serve } from '@hono/node-server'
import { app } from './app'
import { ensureDb, sessionStore } from './store/index'
import { initPassword } from './auth'
import { initIpSearcher } from './ip-region'

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = process.env.HOST || '0.0.0.0'

let initialized = false
const ensureReady = async () => {
  if (initialized) return
  const dbPromise = ensureDb()
  initIpSearcher()
  await dbPromise
  await initPassword()
  initialized = true
}

const main = async () => {
  await ensureReady()

  setInterval(() => {
    sessionStore.cleanupSessions()
  }, 3600000)

  console.info({ host: HOST, port: PORT }, 'Server ready')
  serve({ fetch: app.fetch, port: PORT, hostname: HOST })
}

main().catch((e: any) => {
  console.error(e, 'Failed to start server')
  process.exit(1)
})
