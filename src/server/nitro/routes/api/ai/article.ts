/**
 * AI Article — POST /api/ai/article
 *
 * Public (no auth) endpoint for blog visitors.
 * Accepts article content + URL, returns AI-generated summary with caching.
 *
 * Requires AI_SUMMARY_ENABLED to be true.
 */

import { handleArticleSummary } from '#core/handlers/summary'
import { getConfig } from '#core/config'
import { getSummaryCache, setSummaryCache, redisRateLimit } from '#core/store/redis'
import { getClientIp } from '#core/utils/ip'
import { isDev } from '#core/env'
import { createError } from 'h3'

const MAX_CONTENT_LEN = 20_000
const MAX_TITLE_LEN = 200

const ARTICLE_RATE_MAX = 5
const ARTICLE_RATE_WINDOW = 60_000

function isSafeUrlPath (str: string): boolean {
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return str.startsWith('/') && !/[*?{}[\]]/.test(str)
  }
}

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const cfg = await getConfig()
  if (!cfg.AI_SUMMARY_ENABLED) {
    throw createError({ statusCode: 403, statusMessage: 'AI 摘要功能未启用' })
  }

  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })

  // H1: content length caps
  if (!body.content || typeof body.content !== 'string' || body.content.trim().length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or too short: content' })
  }
  if (body.content.length > MAX_CONTENT_LEN) {
    throw createError({ statusCode: 413, statusMessage: 'Content too long' })
  }

  // C1: url must be a safe path — prevents glob injection into Redis KEYS
  if (!body.url || typeof body.url !== 'string' || !isSafeUrlPath(body.url)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid url' })
  }

  if (body.title && typeof body.title === 'string' && body.title.length > MAX_TITLE_LEN) {
    body.title = body.title.slice(0, MAX_TITLE_LEN)
  }

  const ip = await getClientIp(event)
  // Dev mode: skip rate limiting for testing
  if (!isDev()) {
    const allowed = await redisRateLimit(`article:${ip}`, ARTICLE_RATE_MAX, ARTICLE_RATE_WINDOW)
    if (!allowed) {
      throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })
    }
  }

  const url = body.url as string
  const title = body.title as string | undefined
  const content = body.content as string

  // 1. Check cache (C3: cache key is bound to content hash, so poisoned content can't overwrite legit entry)
  // Dev 下 Redis 不可用，getSummaryCache 自动走内存缓存兜底；生产走 Redis
  const cached = await getSummaryCache(url, content)
  if (cached) {
    return {
      success: true,
      message: '摘要来自缓存',
      summary: cached.summary,
      keywords: cached.keywords,
      cached: true,
    }
  }

  // 2. Generate summary
  const result = await handleArticleSummary({ content, url, title })
  if (!result.success) {
    return { ...result, cached: false }
  }

  // 3. Write cache (bound to url + content hash)
  // Dev 下写入内存缓存，后续访问命中缓存，不再重复调用 LLM
  await setSummaryCache(url, content, {
    url,
    summary: result.summary,
    keywords: result.keywords,
    title,
    created: Date.now(),
  })

  return {
    success: true,
    message: result.message,
    summary: result.summary,
    keywords: result.keywords,
    cached: false,
  }
})
