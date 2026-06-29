/**
 * Admin routes — catch-all for /api/admin/*
 *
 * Aggregates 19 endpoints. Some are public (setup, login, config GET, version, type GET).
 * The refresh endpoint uses inline token checking (not requireAdmin).
 */

import {
  handleLogin, handleLogout, handleGetConfig, handleSetConfig,
  handleConfigReset, handlePasswordSet, handleCheckSetup,
  handleTypeSet, handlePrivateKeyGet, handlePrivateKeySet,
  handleSendNotification, handleEmailTest,
} from '#core/handlers/admin'
import { handleImport, handleExport } from '#core/handlers/import-export'
import { handleDashboardStats, handleDashboardTrend } from '#core/handlers/comment'
import { sessionStore } from '#core/store/index'
import { AppError } from '#core/config'
import { requireAdmin } from '#core/auth'
import { getClientIp } from '#core/utils/ip'
import { isRedisAvailable, listSummaryCaches, clearAllSummaryCaches } from '#core/store/redis'
// validateBody, getToken — auto-imported from nitro/utils/ by Nitro
import { LoginSchema, PasswordSetSchema } from '#core/schemas'

export default defineHandler(async (event) => {
  const path = (event.context.params?.slug as string) || ''
  const segments = path.split('/').filter(Boolean)
  const method = event.method

  // GET /api/admin/setup (public)
  if (segments[0] === 'setup' && method === 'GET') {
    return handleCheckSetup()
  }

  // POST /api/admin/login (public — this IS the auth endpoint)
  if (segments[0] === 'login' && method === 'POST') {
    const data = await validateBody(event, LoginSchema)
    return handleLogin(data, await getClientIp(event))
  }

  // POST /api/admin/logout
  if (segments[0] === 'logout' && method === 'POST') {
    const token = getToken(event)
    await requireAdmin({ token })
    return handleLogout({ token })
  }

  // PUT /api/admin/password
  if (segments[0] === 'password' && method === 'PUT') {
    const data = await validateBody(event, PasswordSetSchema)
    return handlePasswordSet({
      password: data.password,
      token: getToken(event),
    })
  }

  // GET /api/admin/config (public)
  if (segments[0] === 'config' && method === 'GET') {
    return handleGetConfig({})
  }

  // PUT /api/admin/config
  if (segments[0] === 'config' && method === 'PUT') {
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handleSetConfig({ ...body, _ip: await getClientIp(event) })
  }

  // DELETE /api/admin/config
  if (segments[0] === 'config' && method === 'DELETE') {
    await requireAdmin({ token: getToken(event) })
    return handleConfigReset({})
  }

  // GET /api/admin/version (public — inline)
  if (segments[0] === 'version' && method === 'GET') {
    return { version: '1.0.0' }
  }

  // GET /api/admin/dashboard
  if (segments[0] === 'dashboard' && segments.length === 1 && method === 'GET') {
    await requireAdmin({ token: getToken(event) })
    return handleDashboardStats()
  }

  // GET /api/admin/dashboard/trend
  if (segments[0] === 'dashboard' && segments[1] === 'trend' && method === 'GET') {
    await requireAdmin({ token: getToken(event) })
    const days = Math.min(Math.max(parseInt(String(getQuery(event).days) || '7', 10) || 7, 1), 30)
    return handleDashboardTrend(days)
  }

  // GET /api/admin/type (public — inline)
  if (segments[0] === 'type' && method === 'GET') {
    return { data: 'self-hosted' }
  }

  // PUT /api/admin/type
  if (segments[0] === 'type' && method === 'PUT') {
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handleTypeSet(body)
  }

  // GET /api/admin/private-key
  if (segments[0] === 'private-key' && method === 'GET') {
    const key = getQuery(event).key as string | undefined
    if (!key) return { data: null }
    await requireAdmin({ token: getToken(event) })
    return handlePrivateKeyGet({ key })
  }

  // PUT /api/admin/private-key
  if (segments[0] === 'private-key' && method === 'PUT') {
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handlePrivateKeySet(body)
  }

  // POST /api/admin/notification
  if (segments[0] === 'notification' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handleSendNotification(body)
  }

  // POST /api/admin/email-test
  if (segments[0] === 'email-test' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handleEmailTest(body)
  }

  // POST /api/admin/refresh — special: inline token check, not requireAdmin
  if (segments[0] === 'refresh' && method === 'POST') {
    const token = getToken(event)
    if (!token) throw new AppError('NEED_LOGIN', '未提供认证令牌', 401)
    const newToken = await sessionStore.rotateToken(token)
    if (!newToken) throw new AppError('NEED_LOGIN', '会话已过期，请重新登录', 401)
    return { success: true, token: newToken }
  }

  // GET /api/admin/export
  if (segments[0] === 'export' && method === 'GET') {
    await requireAdmin({ token: getToken(event) })
    const format = (getQuery(event).format as string) || 'json'
    return handleExport({ format })
  }

  // POST /api/admin/import/:source — handleImport(source, data) positional args
  if (segments[0] === 'import' && method === 'POST' && segments.length === 2) {
    const source = segments[1]
    const body = await readBody(event).catch(() => ({}))
    await requireAdmin({ token: getToken(event) })
    return handleImport(source, body)
  }

  // GET /api/admin/system — system status (dev mode, DB, Redis, AI stats)
  if (segments[0] === 'system' && method === 'GET') {
    await requireAdmin({ token: getToken(event) })
    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase()
    const dev = !!(import.meta as any).dev || process.env.NODE_ENV !== 'production'
    if (dev) {
      return { dev: true, dbType, redisSkipped: true, summaryCount: 0 }
    }
    const redisOk = await isRedisAvailable()
    let summaryCount = 0
    if (redisOk) {
      try { summaryCount = (await listSummaryCaches()).length } catch { summaryCount = 0 }
    }
    return {
      dev: false,
      dbType,
      redisAvailable: redisOk,
      summaryCount,
    }
  }

  // DELETE /api/admin/data/redis/summaries — clear all summary caches
  if (segments[0] === 'data' && segments[1] === 'redis' && segments[2] === 'summaries' && method === 'DELETE') {
    await requireAdmin({ token: getToken(event) })
    const deleted = await clearAllSummaryCaches()
    return { success: true, deleted, message: `已清空 ${deleted} 条摘要缓存` }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
