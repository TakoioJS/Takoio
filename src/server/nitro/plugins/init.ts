/**
 * Nitro initialization plugin — replaces self-hosted/server.ts startup logic.
 * Runs DB init, IP region searcher, and password cache.
 * In node-server preset, starts hourly session cleanup.
 */

import { ensureDb, sessionStore, initStore } from '#core/store/index'
import { initPassword } from '#core/auth'
import { initIpSearcher } from '#core/ip-region'
import { logger } from '#core/utils/logger'

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
    logger.fatal(`[init] Serverless preset "${getServerlessPreset()}" requires DB_TYPE=mongodb, got "${dbType}". Set MONGODB_URI and DB_TYPE=mongodb in your deployment environment.`)
    throw new Error(`Serverless 环境必须使用 MongoDB（DB_TYPE=mongodb），当前为 "${dbType}"。文件系统临时，SQLite 会丢失数据。`)
  }

  // initIpSearcher (file I/O) is independent of DB — start in parallel
  const dbPromise = ensureDb()
  const storePromise = initStore()
  initIpSearcher()
  await dbPromise
  await storePromise
  const { hasPassword } = await initPassword()

  // Safety: On serverless (Vercel/Netlify) without a password and no SETUP_TOKEN, the admin
  // setup endpoint rejects all attempts — the deployment is effectively broken.
  // Fatal-error at startup so the deployer sees the error immediately in build/deploy logs.
  if (isServerless() && !hasPassword) {
    const SETUP_TOKEN = process.env.SETUP_TOKEN
    if (!SETUP_TOKEN) {
      logger.fatal('[init] Serverless deployment has no admin password and no SETUP_TOKEN. The admin panel setup will be blocked. Set SETUP_TOKEN in your deployment environment to enable first-time password setup.')
      throw new Error('Serverless 环境首次部署必须设置 SETUP_TOKEN 环境变量以初始化管理员密码。请在部署平台配置 SETUP_TOKEN 后重新部署。')
    }
  }

  initialized = true

  // Self-hosted mode: start session cleanup timer
  // Serverless: relies on MongoDB TTL index / cold-start lifecycle
  const preset = process.env.NITRO_PRESET || (import.meta as any).env?.PRESET || ''
  if (preset === 'node-server' || preset === '') {
    setInterval(() => {
      sessionStore.cleanupSessions()
    }, 3600000)
  }

  logger.info('Takoio server ready')
})
