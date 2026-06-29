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
  handleCommentSetSpam, handleCommentApprove,
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

  // GET /api/comments/counter
  if (segments[0] === 'counter' && method === 'GET') {
    const data = validateQuery(event, CounterGetSchema)
    return handleCounterGet(data)
  }

  // POST /api/comments/counter
  if (segments[0] === 'counter' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return handleCounterUpdate(body)
  }

  // ── /:id routes ──────────────────────────────────────

  // Guard: skip :id dispatch for known static sub-paths
  const staticPaths = new Set(['count', 'recent', 'hidden-fields', 'admin', 'counter'])
  if (segments.length >= 1 && !staticPaths.has(segments[0])) {
    const id = segments[0]

    // GET /api/comments/:id/ip-region
    if (segments[1] === 'ip-region' && method === 'GET') {
      await requireAdmin({ token: getToken(event) })
      return handleIpRegionGet({ id })
    }

    // PUT /api/comments/:id
    if (segments.length === 1 && method === 'PUT') {
      const body = await readBody(event)
      await requireAdmin({ token: getToken(event) })
      return handleCommentUpdate({ id, ...body })
    }

    // DELETE /api/comments/:id
    if (segments.length === 1 && method === 'DELETE') {
      await requireAdmin({ token: getToken(event) })
      return handleCommentDelete({ id })
    }

    // PATCH /api/comments/:id/hide
    if (segments[1] === 'hide' && method === 'PATCH') {
      const body = await readBody(event)
      await requireAdmin({ token: getToken(event) })
      return handleCommentHide({ id, hide: body.hide })
    }

    // PATCH /api/comments/:id/top
    if (segments[1] === 'top' && method === 'PATCH') {
      const body = await readBody(event)
      await requireAdmin({ token: getToken(event) })
      return handleCommentSetTop({ id, isTop: body.isTop })
    }

    // PATCH /api/comments/:id/spam
    if (segments[1] === 'spam' && method === 'PATCH') {
      const body = await readBody(event).catch(() => ({}))
      await requireAdmin({ token: getToken(event) })
      return handleCommentSetSpam({ id, isSpam: body.isSpam })
    }

    // PATCH /api/comments/:id/approve
    if (segments[1] === 'approve' && method === 'PATCH') {
      await requireAdmin({ token: getToken(event) })
      return handleCommentApprove({ id })
    }

    // GET /api/comments/:id/reactions
    if (segments[1] === 'reactions' && method === 'GET') {
      const ip = await getClientIp(event)
      return handleCommentReactionGet({ id, _ip: ip })
    }

    // POST /api/comments/:id/reactions
    if (segments[1] === 'reactions' && method === 'POST') {
      const ip = await getClientIp(event)
      const body = await readBody(event).catch(() => ({}))
      return handleCommentReactionSubmit({ id, emoji: body.emoji, _ip: ip })
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
