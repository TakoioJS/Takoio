import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAdmin } from '../auth'
import { getClientIp } from '../utils/ip'
import {
  handleLogin, handleLogout, handleGetConfig, handleSetConfig,
  handleConfigReset, handlePasswordSet, handleCheckSetup,
  handleTypeSet, handlePrivateKeyGet, handlePrivateKeySet,
  handleSendNotification, handleEmailTest,
} from '../handlers/admin'
import { handleImport, handleExport } from '../handlers/import-export'
import { handleDashboardStats, handleDashboardTrend } from '../handlers/comment'
import { sessionStore } from '../store/index'
import { AppError } from '../config'
import { LoginSchema, PasswordSetSchema, ExportSchema, ImportSchema } from '../schemas'

const getToken = (c: any): string | undefined => {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}

export const adminRoutes = new Hono()

// GET /api/admin/setup — 检查是否需要首次设置
adminRoutes.get('/setup', async (c) => {
  return c.json(await handleCheckSetup())
})

// POST /api/admin/login — 登录
adminRoutes.post('/login', zValidator('json', LoginSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await handleLogin(body, await getClientIp(c))
  return c.json(result)
})

// POST /api/admin/logout — 登出
adminRoutes.post('/logout', async (c) => {
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleLogout({ token: getToken(c) }))
})

// PUT /api/admin/password — 设置密码
adminRoutes.put('/password', zValidator('json', PasswordSetSchema), async (c) => {
  const body = c.req.valid('json')
  return c.json(await handlePasswordSet({
    password: body.password,
    token: getToken(c),
  }))
})

// GET /api/admin/config — 获取配置
adminRoutes.get('/config', async (c) => {
  return c.json(await handleGetConfig({}))
})

// PUT /api/admin/config — 更新配置
adminRoutes.put('/config', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleSetConfig({ ...body, _ip: await getClientIp(c) }))
})

// DELETE /api/admin/config — 重置配置
adminRoutes.delete('/config', async (c) => {
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleConfigReset({}))
})

// GET /api/admin/version — 获取版本
adminRoutes.get('/version', async (c) => {
  return c.json({ version: '1.0.0' })
})

// GET /api/admin/dashboard — 仪表盘统计
adminRoutes.get('/dashboard', async (c) => {
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleDashboardStats())
})

// GET /api/admin/dashboard/trend — 近 N 天评论趋势
adminRoutes.get('/dashboard/trend', async (c) => {
  await requireAdmin({ token: getToken(c) })
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '7', 10) || 7, 1), 30)
  return c.json(await handleDashboardTrend(days))
})

// GET /api/admin/type — 获取类型
adminRoutes.get('/type', async (c) => {
  return c.json({ data: 'self-hosted' })
})

// PUT /api/admin/type — 设置类型
adminRoutes.put('/type', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleTypeSet(body))
})

// GET /api/admin/private-key — 获取私钥
adminRoutes.get('/private-key', async (c) => {
  const key = c.req.query('key')
  if (!key) return c.json({ data: null })
  await requireAdmin({ token: getToken(c) })
  return c.json(await handlePrivateKeyGet({ key }))
})

// PUT /api/admin/private-key — 设置私钥
adminRoutes.put('/private-key', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handlePrivateKeySet(body))
})

// POST /api/admin/notification — 发送通知
adminRoutes.post('/notification', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleSendNotification(body))
})

// POST /api/admin/email-test — 测试邮件
adminRoutes.post('/email-test', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleEmailTest(body))
})

// POST /api/admin/refresh — 刷新会话 token
adminRoutes.post('/refresh', async (c) => {
  const token = getToken(c)
  if (!token) throw new AppError('NEED_LOGIN', '未提供认证令牌', 401)
  const newToken = await sessionStore.rotateToken(token)
  if (!newToken) throw new AppError('NEED_LOGIN', '会话已过期，请重新登录', 401)
  return c.json({ success: true, token: newToken })
})

// GET /api/admin/export — 导出评论
adminRoutes.get('/export', async (c) => {
  await requireAdmin({ token: getToken(c) })
  const format = c.req.query('format') || 'json'
  return c.json(await handleExport({ format }))
})

// POST /api/admin/import/:source — 导入评论
adminRoutes.post('/import/:source', async (c) => {
  const source = c.req.param('source')
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleImport(source, body))
})
