/**
 * Nitro initialization plugin — replaces self-hosted/server.ts startup logic.
 * Runs DB init, IP region searcher, and password cache.
 * In node-server preset, starts hourly session cleanup.
 */

import { ensureDb, sessionStore, initStore } from '#core'
import { initPassword } from '#core'
import { initIpSearcher } from '#core'
import { closeRedis } from '#core'
import { logger } from '#core'
import { isServerless, getPresetName, DB_TYPE, SETUP_TOKEN, validateAuthJwtSecret } from '#core'
import { closeDb } from '#core'

let initialized = false

export default definePlugin(async () => {
  if (initialized) return

  // C1(deploy): Validate JWT secret strength before anything else
  validateAuthJwtSecret()

  // C1(deploy): Fail fast on serverless if DB_TYPE is sqlite — ephemeral filesystem causes data loss
  const dbType = DB_TYPE
  if (isServerless() && dbType !== 'mongodb') {
    logger.fatal(`[init] Serverless preset "${getPresetName()}" requires DB_TYPE=mongodb, got "${dbType}". Set MONGODB_URI and DB_TYPE=mongodb in your deployment environment.`)
    throw new Error(`Serverless 环境必须使用 MongoDB（DB_TYPE=mongodb），当前为 "${dbType}"。文件系统临时，SQLite 会丢失数据。`)
  }

  // initIpSearcher (file I/O + dynamic import) is independent of DB — fire-and-forget
  // 不阻塞 server ready：lookupIpRegion 在 searcher 就绪前返回空串，就绪后自动生效
  const dbPromise = ensureDb()
  const storePromise = initStore()
  initIpSearcher().catch(() => {})
  await dbPromise
  await storePromise
  const { hasPassword } = await initPassword()

  // Safety: On serverless (Vercel/Netlify) without a password and no SETUP_TOKEN, the admin
  // setup endpoint rejects all attempts — the deployment is effectively broken.
  // Fatal-error at startup so the deployer sees the error immediately in build/deploy logs.
  if (isServerless() && !hasPassword) {
    if (!SETUP_TOKEN) {
      logger.fatal('[init] Serverless deployment has no admin password and no SETUP_TOKEN. The admin panel setup will be blocked. Set SETUP_TOKEN in your deployment environment to enable first-time password setup.')
      throw new Error('Serverless 环境首次部署必须设置 SETUP_TOKEN 环境变量以初始化管理员密码。请在部署平台配置 SETUP_TOKEN 后重新部署。')
    }
  }

  initialized = true

  // Self-hosted mode: start session cleanup timer
  // Serverless: relies on MongoDB TTL index / cold-start lifecycle
  const preset = getPresetName()
  if (preset === 'node-server' || preset === '') {
    setInterval(() => {
      sessionStore.cleanupSessions()
    }, 3600000)
  }

  logger.info('Takoio server ready')

  // 非 serverless 环境注册优雅关闭信号处理
  if (!isServerless()) {
    let shuttingDown = false

    const handleShutdown = async (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true
      logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...')

      // 停止接收新连接 + 给 in-flight 请求完成时间
      // 旧实现在此处用 setImmediate 立即 resolve + clearTimeout(timeout)，
      // 把 10s grace period 缩成 ~0ms，随后 closeDb() 立即执行会中断
      // in-flight 的 DB 写入（如评论提交事务）→ 数据丢失。
      // 修复：移除 setImmediate 短路；同时移除 .unref()，否则当 in-flight refs
      // 清空后进程会立即退出，closeDb()/closeRedis() 永远不会执行。
      await new Promise<void>(resolve => {
        setTimeout(() => {
          logger.warn('Graceful shutdown timeout reached, forcing exit')
          resolve()
        }, 10_000)
      })

      // 关闭 Redis 连接
      try { await closeRedis() } catch {}
      // 关闭数据库连接
      try { await closeDb() } catch {}

      logger.info('Shutdown complete')
      process.exit(0)
    }

    process.on('SIGTERM', () => handleShutdown('SIGTERM'))
    process.on('SIGINT', () => handleShutdown('SIGINT'))
  }
})
