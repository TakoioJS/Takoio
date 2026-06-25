/**
 * Hono app — pure app definition with middleware and routes.
 * No startup/shutdown logic — safe to import in any environment.
 */

import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { compress } from 'hono/compress'
import { config } from 'dotenv'
import { corsMiddleware } from './middleware/cors'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { logger } from './utils/logger'
import { AppError } from './utils/errors'
import { commentRoutes } from './routes/comment'
import { adminRoutes } from './routes/admin'
import { visitorRoutes } from './routes/visitor'
import { uploadRoutes } from './routes/upload'

config()

export const app = new Hono()

// Global middleware
app.use('*', honoLogger())
app.use('*', corsMiddleware)
app.use('*', compress())
app.use('*', rateLimitMiddleware)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }))

// Homepage
app.get('/', (c) => c.text('Takoio server is running (v1.0.0)'))

// REST API routes — all under /api
const api = new Hono()
  .route('/comments', commentRoutes)
  .route('/admin', adminRoutes)
  .route('/counter', visitorRoutes)
  .route('/upload', uploadRoutes)

app.route('/api', api)

// Legacy single-endpoint handler (transitional)
import { adminEvents, requireAdmin } from './auth'
import { getClientIp } from './utils/ip'
import { dispatchEvent } from './handlers'

const handleApi = async (c: any) => {
  const ip = await getClientIp(c)
  const body = await c.req.json().catch(() => ({}))
  const { event, ...data } = body
  if (!event) throw new AppError('INVALID_INPUT', '缺少 event 参数', 400)
  const ctx = { ...data, _ip: ip }
  if (adminEvents.has(event)) await requireAdmin(ctx)
  return c.json({ result: await dispatchEvent(event, ctx) })
}

app.post('/', handleApi)
app.post('/takoio', handleApi)

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ message: err.message, code: err.code }, err.statusCode as any)
  }
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled API Error')
  return c.json({ message: '服务器内部错误' }, 500)
})

export type AppType = typeof app
