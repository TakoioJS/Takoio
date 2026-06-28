/**
 * Hono app — pure app definition with middleware and routes.
 * No startup/shutdown logic — safe to import in any environment.
 */

import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { compress } from 'hono/compress'
import { serveStatic } from '@hono/node-server/serve-static'
import { config } from 'dotenv'
import { corsMiddleware } from './middleware/cors'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { AppError } from './config'
import { commentRoutes } from './routes/comment'
import { adminRoutes } from './routes/admin'
import { uploadRoutes } from './routes/upload'
import { handleReactionGet, handleReactionSubmit } from './handlers/comment'
import { handleSSEConnect } from './events'
import { existsSync, readFileSync } from 'node:fs'
import { getClientIp } from './utils/ip'
import { join } from 'node:path'

// Only load .env file in self-hosted / local dev.
// Serverless platforms (Vercel, Netlify, Lambda) inject env vars directly.
if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  config()
}

export const app = new Hono()

// Global middleware
app.use(honoLogger() as any)
app.use(corsMiddleware as any)
app.use(compress() as any)
app.use(rateLimitMiddleware as any)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }))

// Homepage
app.get('/', (c) => c.text('Takoio server is running (v1.0.0)'))

// Admin SPA — serve the built static files at /admin
const adminDistDir = [
  join(process.cwd(), 'admin-dist'),
  join(process.cwd(), 'src/admin/dist'),
  join(process.cwd(), 'dist/admin'),
].find(p => existsSync(p))

if (adminDistDir) {
  // serveStatic 用完整 URL path 拼接 root，需剥离 /admin 前缀
  app.use('/admin/*', serveStatic({
    root: adminDistDir,
    rewriteRequestPath: (path) => path.replace(/^\/admin/, '') || '/',
  }))
  // SPA fallback: 非文件路径返回 index.html（支持 vue-router history 模式）
  app.get('/admin', (c) => c.html(readFileSync(join(adminDistDir, 'index.html'), 'utf-8')))
  app.get('/admin/*', (c) => {
    const url = new URL(c.req.url).pathname
    // 只对无扩展名的路径做 SPA 回退，有扩展名的资源已由 serveStatic 处理
    if (/\.\w+$/.test(url)) return c.notFound()
    return c.html(readFileSync(join(adminDistDir, 'index.html'), 'utf-8'))
  })
}

// REST API routes — all under /api
const api = new Hono()
  .route('/comments', commentRoutes)
  .route('/admin', adminRoutes)
  .route('/upload', uploadRoutes)

app.route('/api', api)

// Reactions — page-level (no comment ID required)
app.get('/api/reactions', async (c) => {
  const url = c.req.query('url') || '/'
  const ip = await getClientIp(c)
  return c.json(await handleReactionGet({ url, _ip: ip }))
})
app.post('/api/reactions', async (c) => {
  const url = c.req.query('url') || '/'
  const ip = await getClientIp(c)
  const body = await c.req.json().catch(() => ({}))
  return c.json(await handleReactionSubmit({ url, emoji: body.emoji, _ip: ip }))
})

// SSE real-time events — GET /api/events?url=/path
app.get('/api/events', handleSSEConnect)

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ message: err.message, code: err.code }, err.statusCode as any)
  }
  console.error({ error: err.message, stack: err.stack }, 'Unhandled API Error')
  return c.json({ message: '服务器内部错误' }, 500)
})

export type AppType = typeof app
