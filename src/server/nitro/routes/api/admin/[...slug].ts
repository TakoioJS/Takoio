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
import { requireAdmin, validateOrigin } from '#core/auth'
import { getClientIp } from '#core/utils/ip'
import { isRedisAvailable, listSummaryCaches } from '#core/store/redis'
import { isDev } from '#core/env'
// validateBody, getToken — auto-imported from nitro/utils/ by Nitro
import { LoginSchema, PasswordSetSchema, TypeSetSchema, SetConfigSchema, PrivateKeySetSchema, SendNotificationSchema, EmailTestSchema, ImportSchema, DashboardTrendSchema } from '#core/schemas'

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

  // POST /api/admin/logout — allow logout even with expired/invalid token
  if (segments[0] === 'logout' && method === 'POST') {
    const token = getToken(event)
    if (token) {
      await sessionStore.removeToken(token)
    }
    return handleLogout({ token: token || '' })
  }

  // PUT /api/admin/password
  if (segments[0] === 'password' && method === 'PUT') {
    const data = await validateBody(event, PasswordSetSchema)
    return handlePasswordSet({
      password: data.password,
      setupToken: data.setupToken,
      token: getToken(event),
    })
  }

  // GET /api/admin/config (admin only — contains masked secrets & full config structure)
  if (segments[0] === 'config' && method === 'GET') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    return handleGetConfig()
  }

  // PUT /api/admin/config
  if (segments[0] === 'config' && method === 'PUT') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    const data = await validateBody(event, SetConfigSchema)
    return handleSetConfig({ ...data, _ip: await getClientIp(event) })
  }

  // DELETE /api/admin/config
  if (segments[0] === 'config' && method === 'DELETE') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    return handleConfigReset()
  }

  // GET /api/admin/version (public — minimal)
  if (segments[0] === 'version' && method === 'GET') {
    return { version: '1.0.0' }
  }

  // GET /api/admin/dashboard
  if (segments[0] === 'dashboard' && segments.length === 1 && method === 'GET') {
    const token = getToken(event)
    await requireAdmin({ token })
    return handleDashboardStats()
  }

  // GET /api/admin/dashboard/trend
  if (segments[0] === 'dashboard' && segments[1] === 'trend' && method === 'GET') {
    const token = getToken(event)
    await requireAdmin({ token })
    const { days } = validateQuery(event, DashboardTrendSchema)
    return handleDashboardTrend(days)
  }

  // GET /api/admin/type (public — minimal)
  if (segments[0] === 'type' && method === 'GET') {
    return { data: 'self-hosted' }
  }

  // PUT /api/admin/type
  if (segments[0] === 'type' && method === 'PUT') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    const data = await validateBody(event, TypeSetSchema)
    return handleTypeSet(data)
  }

  // GET /api/admin/private-key
  if (segments[0] === 'private-key' && method === 'GET') {
    const key = getQuery(event).key as string | undefined
    if (!key) return { data: null }
    const token = getToken(event)
    await requireAdmin({ token })
    return handlePrivateKeyGet({ key })
  }

  // PUT /api/admin/private-key
  if (segments[0] === 'private-key' && method === 'PUT') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    const data = await validateBody(event, PrivateKeySetSchema)
    return handlePrivateKeySet(data)
  }

  // POST /api/admin/notification
  if (segments[0] === 'notification' && method === 'POST') {
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    const data = await validateBody(event, SendNotificationSchema)
    return handleSendNotification(data)
  }

  // POST /api/admin/email-test
  if (segments[0] === 'email-test' && method === 'POST') {
    const token = getToken(event)
    await requireAdmin({ token })
    const data = await validateBody(event, EmailTestSchema)
    return handleEmailTest(data)
  }

  // POST /api/admin/refresh — token rotation
  if (segments[0] === 'refresh' && method === 'POST') {
    const token = getToken(event)
    await requireAdmin({ token })
    const newToken = await sessionStore.rotateToken(token!)
    if (!newToken) throw new AppError('NEED_LOGIN', '会话已过期，请重新登录', 401)
    return { success: true, token: newToken }
  }

  // GET /api/admin/export
  if (segments[0] === 'export' && method === 'GET') {
    const token = getToken(event)
    await requireAdmin({ token })
    return handleExport({ format: (getQuery(event).format as string) || 'json' })
  }

  // POST /api/admin/import/:source — handleImport(source, data) positional args
  if (segments[0] === 'import' && method === 'POST' && segments.length === 2) {
    const source = segments[1]
    const token = getToken(event)
    await requireAdmin({ token })
    await validateOrigin(event)
    const body = await validateBody(event, ImportSchema)
    return handleImport(source, body)
  }

  // GET /api/admin/system — system status (dev mode, DB, Redis, AI stats)
  if (segments[0] === 'system' && method === 'GET') {
    const token = getToken(event)
    await requireAdmin({ token })
    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase()
    // 始终检查实际 Redis 连通性，不依赖 isDev()（云函数平台 import.meta.dev 可能误判）
    const redisOk = await isRedisAvailable()
    let summaryCount = 0
    if (redisOk) {
      try { summaryCount = (await listSummaryCaches()).length } catch { summaryCount = 0 }
    }
    return {
      dev: isDev(),
      dbType,
      redisAvailable: redisOk,
      summaryCount,
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
