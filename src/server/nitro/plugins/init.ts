/**
 * Nitro initialization plugin — replaces self-hosted/server.ts startup logic.
 * Runs DB init, IP region searcher, and password cache.
 * In node-server preset, starts hourly session cleanup.
 */

import { ensureDb, sessionStore } from '#core/store/index'
import { initPassword } from '#core/auth'
import { initIpSearcher } from '#core/ip-region'

let initialized = false

export default definePlugin(async () => {
  if (initialized) return

  // initIpSearcher (file I/O) is independent of DB — start in parallel
  const dbPromise = ensureDb()
  initIpSearcher()
  await dbPromise
  await initPassword()
  initialized = true

  // Self-hosted mode: start session cleanup timer
  // Serverless: relies on MongoDB TTL index / cold-start lifecycle
  const preset = process.env.NITRO_PRESET || (import.meta as any).env?.PRESET || ''
  if (preset === 'node-server' || preset === '') {
    setInterval(() => {
      sessionStore.cleanupSessions()
    }, 3600000)
  }

  console.info('Takoio server ready')
})
