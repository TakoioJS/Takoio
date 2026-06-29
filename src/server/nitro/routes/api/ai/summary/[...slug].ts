/**
 * Summary routes — /api/ai/summary/*
 *
 * Admin-only routes for summary generation, testing, and cache management.
 */

import { handleArticleSummary } from '#core/handlers/summary'
import { requireAdmin } from '#core/auth'
import {
  listSummaryCaches,
  deleteSummaryCacheByUrl,
  clearAllSummaryCaches,
} from '#core/store/redis'
import { isRedisAvailable } from '#core/store/redis'
// getToken, validateBody, validateQuery — auto-imported

export default defineHandler(async (event) => {
  const path = (event.context.params?.slug as string) || ''
  const segments = path.split('/').filter(Boolean)
  const method = event.method

  // All summary routes require admin auth
  await requireAdmin({ token: getToken(event) })

  // ── POST /api/ai/summary (original: generate summary, no cache) ──
  // ── POST /api/ai/summary/test (alias: test generate, no cache) ──
  if ((segments.length === 0 || segments[0] === 'test') && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    if (!body.content || typeof body.content !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Missing required field: content' })
    }
    return handleArticleSummary({
      content: body.content,
      url: body.url,
      title: body.title,
      provider: body.provider,
      model: body.model,
    })
  }

  // ── GET /api/ai/summary/list — list all cached summaries ──
  if (segments[0] === 'list' && method === 'GET') {
    const redisOk = await isRedisAvailable()
    if (!redisOk) {
      return { success: true, summaries: [], redisAvailable: false }
    }
    const summaries = await listSummaryCaches()
    return { success: true, summaries, redisAvailable: true }
  }

  // ── DELETE /api/ai/summary — delete cached summaries for a specific URL ──
  if (segments.length === 0 && method === 'DELETE') {
    const query = getQuery(event)
    const url = query.url as string
    if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })
    const deleted = await deleteSummaryCacheByUrl(url)
    return { success: true, deleted, message: `已删除 ${deleted} 条摘要缓存` }
  }

  // ── DELETE /api/ai/summary/all — clear all cached summaries ──
  if (segments[0] === 'all' && method === 'DELETE') {
    const deleted = await clearAllSummaryCaches()
    return { success: true, deleted, message: `已清空 ${deleted} 条摘要缓存` }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
