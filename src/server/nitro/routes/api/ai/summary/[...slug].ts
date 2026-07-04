/**
 * AI Summary admin routes — catch-all for /api/ai/summary/*
 *
 * Method × path 路由分发：
 * - GET    /api/ai/summary/list   列出全部摘要缓存（后台编辑用）
 * - POST   /api/ai/summary/test   临时生成摘要（不写入缓存）
 * - PUT    /api/ai/summary        按 key 更新摘要（编辑保存）
 * - DELETE /api/ai/summary?url=…  按 URL 删除某页面全部缓存
 * - DELETE /api/ai/summary/all    清空全部摘要缓存
 *
 * 所有接口需 admin 鉴权。客户端调用方：src/admin/views/ai/Summary.vue
 */

import {
  listSummaryCaches,
  updateSummaryCache,
  deleteSummaryCacheByUrl,
  clearAllSummaryCaches,
  handleArticleSummary,
  requireAdmin,
} from '#core'
import { getToken } from '../../../../utils/auth'
import { createError, getQuery, readBody } from 'h3'

export default defineHandler(async (event) => {
  const slug = (event.context.params?.slug as string) || ''
  const segments = slug.split('/').filter(Boolean)
  const sub = segments[0] || ''
  const method = event.method

  // 统一鉴权（所有 summary admin 接口均需 admin 权限）
  const token = getToken(event)
  await requireAdmin({ token })

  // GET /api/ai/summary/list
  if (method === 'GET' && sub === 'list') {
    const items = await listSummaryCaches()
    return { success: true, summaries: items }
  }

  // POST /api/ai/summary/test — 临时生成摘要（不写入缓存）
  if (method === 'POST' && sub === 'test') {
    const body = await readBody(event).catch(() => null) as { content?: string; title?: string; url?: string } | null
    if (!body || typeof body.content !== 'string' || body.content.trim().length < 10) {
      throw createError({ statusCode: 400, statusMessage: 'Missing or too short: content' })
    }
    // 用虚拟 url 避免污染真实缓存；handleArticleSummary 内部不写缓存，仅生成
    const result = await handleArticleSummary({
      content: body.content,
      url: body.url || '/__admin_test__',
      title: body.title,
    })
    return result
  }

  // PUT /api/ai/summary — 按 key 更新摘要
  if (method === 'PUT' && !sub) {
    const body = await readBody(event).catch(() => null) as { key?: string; summary?: string; keywords?: string[]; title?: string } | null
    if (!body || typeof body.key !== 'string' || !body.key) {
      throw createError({ statusCode: 400, statusMessage: 'Missing key' })
    }
    const ok = await updateSummaryCache(body.key, {
      summary: body.summary,
      keywords: body.keywords,
      title: body.title,
    })
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: '摘要不存在或已过期' })
    }
    return { success: true }
  }

  // DELETE /api/ai/summary/all — 清空全部
  if (method === 'DELETE' && sub === 'all') {
    const n = await clearAllSummaryCaches()
    return { success: true, count: n }
  }

  // DELETE /api/ai/summary?url=… — 按 URL 删除
  if (method === 'DELETE' && !sub) {
    const url = getQuery(event).url
    if (!url || typeof url !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Missing url query parameter' })
    }
    const n = await deleteSummaryCacheByUrl(url)
    return { success: true, count: n }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
