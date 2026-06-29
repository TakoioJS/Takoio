/**
 * Nitro initialization plugin — replaces self-hosted/server.ts startup logic.
 * Runs DB init, IP region searcher, and password cache.
 * In node-server preset, starts hourly session cleanup.
 */

import { ensureDb, sessionStore } from '#core/store/index'
import { initPassword } from '#core/auth'
import { initIpSearcher } from '#core/ip-region'

let initialized = false

function getServerlessPreset (): string {
  return (process.env.NITRO_PRESET || (import.meta as any).env?.PRESET || '').toLowerCase()
}

function isServerless (): boolean {
  const preset = getServerlessPreset()
  return preset === 'vercel' || preset === 'netlify' || preset === 'cloudflare'
}

export default definePlugin(async () => {
  if (initialized) return

  // C1(deploy): Fail fast on serverless if DB_TYPE is sqlite — ephemeral filesystem causes data loss
  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase()
  if (isServerless() && dbType !== 'mongodb') {
    console.error(`[init] Serverless preset "${getServerlessPreset()}" requires DB_TYPE=mongodb, got "${dbType}". Set MONGODB_URI and DB_TYPE=mongodb in your deployment environment.`)
  }

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
