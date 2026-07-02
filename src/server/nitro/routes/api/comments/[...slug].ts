/**
 * Comment routes — catch-all for /api/comments/*
 *
 * Aggregates 23 endpoints in a single file, matching the original
 * Hono sub-router granularity. Dispatches by path segments + method.
 */

import {
  handleCommentUpdate,
  handleCommentDelete,
  handleCommentHide, handleCommentGetAdmin, handleCommentSetTop,
  handleCommentSetSpam, handleCommentApprove, handleCommentBatch,
  handleCounterGet, handleCounterUpdate,
  handleGetCommentsCount, handleGetRecentComments,
  handleCommentReactionGet, handleCommentReactionSubmit,
} from '#core/handlers/comment'
import { handleHiddenFieldsGet, handleIpRegionGet } from '#core/handlers/admin'
import { requireAdmin } from '#core/auth'
import { getClientIp } from '#core/utils/ip'
// validateQuery, validateBody, getToken — auto-imported from nitro/utils/ by Nitro
import {
  RecentCommentsSchema, CounterGetSchema,
  CounterUpdateSchema, CommentReactionSubmitSchema,
  UpdateCommentSchema, CommentActionSchema,
} from '#core/schemas'

export default defineHandler(async (event) => {
  const path = (event.context.params?.slug as string) || ''
  const segments = path.split('/').filter(Boolean)
  const method = event.method

  // ── Static sub-paths (must match before :id dispatch) ──

  // GET /api/comments/count
  if (segments[0] === 'count' && method === 'GET') {
    const raw = getQuery(event).urls as string | undefined
    const urls = raw ? raw.split(',') : []
    return handleGetCommentsCount({ urls })
  }

  // GET /api/comments/recent
  if (segments[0] === 'recent' && method === 'GET') {
    const { count } = validateQuery(event, RecentCommentsSchema)
    return handleGetRecentComments({ count })
  }

  // GET /api/comments/hidden-fields
  if (segments[0] === 'hidden-fields' && method === 'GET') {
    return handleHiddenFieldsGet()
  }

  // GET /api/comments/admin
  if (segments[0] === 'admin' && method === 'GET' && segments.length === 1) {
    await requireAdmin({ token: getToken(event) })
    const query = getQuery(event)
    return handleCommentGetAdmin({
      page: Number(query.page) || 1,
      pageSize: Number(query.pageSize) || 20,
      search: query.search as string | undefined,
      filter: query.filter as any,
    })
  }

  // POST /api/comments/batch — 批量管理操作（hide/show/delete/spam/approve/unspam）
  // 单次请求处理多条评论，避免前端 Promise.all 触发 N+1 HTTP/DB/Redis 风暴
  if (segments[0] === 'batch' && method === 'POST' && segments.length === 1) {
    await requireAdmin({ token: getToken(event) })
    const body = await readBody(event).catch(() => null) as { ids?: string[]; action?: string } | null
    return handleCommentBatch({
      ids: Array.isArray(body?.ids) ? body!.ids : [],
      action: (body?.action || '') as any,
    })
  }

  // GET /api/comments/counter
  if (segments[0] === 'counter' && method === 'GET') {
    const data = validateQuery(event, CounterGetSchema)
    return handleCounterGet(data)
  }

  // POST /api/comments/counter
  if (segments[0] === 'counter' && method === 'POST') {
    const data = await validateBody(event, CounterUpdateSchema)
    return handleCounterUpdate(data)
  }

  // ── /:id routes ──────────────────────────────────────

  // Guard: skip :id dispatch for known static sub-paths
  const staticPaths = new Set(['count', 'recent', 'hidden-fields', 'admin', 'counter', 'batch'])
  if (segments.length >= 1 && !staticPaths.has(segments[0])) {
    const id = segments[0]

    // GET /api/comments/:id/ip-region
    if (segments[1] === 'ip-region' && method === 'GET') {
      await requireAdmin({ token: getToken(event) })
      return handleIpRegionGet({ id })
    }

    // PUT /api/comments/:id
    if (segments.length === 1 && method === 'PUT') {
      await requireAdmin({ token: getToken(event) })
      const data = await validateBody(event, UpdateCommentSchema)
      return handleCommentUpdate({ id, ...data })
    }

    // DELETE /api/comments/:id
    if (segments.length === 1 && method === 'DELETE') {
      await requireAdmin({ token: getToken(event) })
      return handleCommentDelete({ id }, event)
    }

    // PATCH /api/comments/:id/hide
    if (segments[1] === 'hide' && method === 'PATCH') {
      await requireAdmin({ token: getToken(event) })
      const data = await validateBody(event, CommentActionSchema)
      return handleCommentHide({ id, hide: data.hide })
    }

    // PATCH /api/comments/:id/top
    if (segments[1] === 'top' && method === 'PATCH') {
      await requireAdmin({ token: getToken(event) })
      const body = await readBody(event).catch(() => null) as { isTop?: boolean } | null
      return handleCommentSetTop({ id, isTop: body?.isTop })
    }

    // PATCH /api/comments/:id/spam
    if (segments[1] === 'spam' && method === 'PATCH') {
      await requireAdmin({ token: getToken(event) })
      const body = await readBody(event).catch(() => null) as { isSpam?: boolean } | null
      return handleCommentSetSpam({ id, isSpam: body?.isSpam })
    }

    // PATCH /api/comments/:id/approve
    if (segments[1] === 'approve' && method === 'PATCH') {
      await requireAdmin({ token: getToken(event) })
      return handleCommentApprove({ id }, event)
    }

    // GET /api/comments/:id/reactions
    if (segments[1] === 'reactions' && method === 'GET') {
      const ip = await getClientIp(event)
      return handleCommentReactionGet({ id, _ip: ip })
    }

    // POST /api/comments/:id/reactions
    if (segments[1] === 'reactions' && method === 'POST') {
      const ip = await getClientIp(event)
      const data = await validateBody(event, CommentReactionSubmitSchema)
      return handleCommentReactionSubmit({ id: data.id || id, emoji: data.emoji, _ip: ip })
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
