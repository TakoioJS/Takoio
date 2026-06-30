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
  updateSummaryCache,
} from '#core/store/redis'
import { isRedisAvailable } from '#core/store/redis'
import { isDev } from '#core/utils/env'
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
    const body = await readBody(event).catch(() => null)
    if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
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
    const dev = isDev()
    const redisOk = dev ? false : await isRedisAvailable()
    if (!dev && !redisOk) {
      return { success: true, summaries: [], redisAvailable: false }
    }
    // dev 走内存缓存兜底；生产走 Redis
    const summaries = await listSummaryCaches()
    return { success: true, summaries, redisAvailable: redisOk, dev }
  }

  // ── PUT /api/ai/summary — edit a cached summary by key (content/keywords/title) ──
  if (segments.length === 0 && method === 'PUT') {
    const body = await readBody(event).catch(() => null)
    if (!body || typeof body !== 'object' || !body.key || typeof body.key !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Missing required field: key' })
    }
    const patch: { summary?: string; keywords?: string[]; title?: string } = {}
    if (typeof body.summary === 'string') patch.summary = body.summary
    if (Array.isArray(body.keywords)) patch.keywords = body.keywords.map((k: any) => String(k)).filter(Boolean)
    if (typeof body.title === 'string') patch.title = body.title
    const ok = await updateSummaryCache(body.key, patch)
    if (!ok) throw createError({ statusCode: 404, statusMessage: '摘要不存在或已过期' })
    return { success: true, message: '摘要已更新' }
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
