/**
 * Self-hosted startup — initialization + HTTP server.
 * Only imported by the self-hosted entry point (server.ts), never by Serverless adapters.
 */

import { serve } from '@hono/node-server'
import { app } from './app'
import { ensureDb, sessionStore } from './store/index'
import { initPassword } from './auth'
import { initIpSearcher } from './ip-region'
import { logger } from './utils/logger'

const PORT = parseInt(process.env.PORT || '8080', 10)
const HOST = process.env.HOST || '0.0.0.0'

let initialized = false
export const ensureReady = async () => {
  if (initialized) return
  await ensureDb()
  await initPassword()
  initIpSearcher()
  initialized = true
}

export const main = async () => {
  await ensureReady()

  setInterval(() => {
    sessionStore.cleanupSessions()
  }, 3600000)

  logger.info({ host: HOST, port: PORT }, `Takoio v1.0.0 ready`)
  serve({ fetch: app.fetch, port: PORT, hostname: HOST })
}
