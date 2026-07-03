/**
 * Comment catch-all routes — /api/comments/[...slug]
 *
 * Dispatches to public or admin handlers based on the slug.
 */

import {
  handleCommentGet, handleCommentSubmit,
  handleCommentGetAdmin, handleCommentUpdate, handleCommentDelete,
  handleCommentHide, handleCommentSetTop, handleCommentSetSpam,
  handleCommentApprove, handleCommentBatch,
  handleIpRegionGet,
} from '#core'
import { getClientIp, requireAdmin } from '#core'
import { GetCommentSchema, SubmitCommentSchema, AdminCommentSchema } from '#core'
import { buildRequestContext } from '../../../utils/request-context'

export default defineHandler(async (event) => {
  const method = event.method
  const slug = (event.context.params?.slug as string) || ''

  // GET /api/comments/admin — admin list
  if (method === 'GET' && slug === 'admin') {
    const token = getToken(event)
    await requireAdmin({ token })
    return handleCommentGetAdmin(validateQuery(event, AdminCommentSchema))
  }

  // PUT /api/comments/:id — admin update
  if (method === 'PUT' && slug && !slug.includes('/')) {
    const token = getToken(event)
    await requireAdmin({ token })
    const body = await readBody(event)
    return handleCommentUpdate({ ...body, id: slug })
  }

  // PATCH /api/comments/:id/action
  if (method === 'PATCH' && slug?.includes('/')) {
    const token = getToken(event)
    await requireAdmin({ token })
    const [id, action] = slug.split('/')
    if (action === 'hide') {
      const body = await readBody(event)
      return handleCommentHide({ id, hide: body?.hide ?? true })
    }
    if (action === 'top') {
      const body = await readBody(event)
      return handleCommentSetTop({ id, isTop: body?.isTop ?? true })
    }
    if (action === 'spam') {
      const body = await readBody(event)
      return handleCommentSetSpam({ id, isSpam: body?.isSpam ?? true })
    }
    if (action === 'approve') {
      return handleCommentApprove({ id })
    }
  }

  // DELETE /api/comments/:id — admin delete
  if (method === 'DELETE' && slug && !slug.includes('/')) {
    const token = getToken(event)
    await requireAdmin({ token })
    return handleCommentDelete({ id: slug })
  }

  // POST /api/comments/batch — admin batch
  if (method === 'POST' && slug === 'batch') {
    const token = getToken(event)
    await requireAdmin({ token })
    const body = await readBody(event)
    return handleCommentBatch(body)
  }

  // GET /api/comments/:id/ip-region — admin IP region lookup
  if (method === 'GET' && slug?.includes('/') && slug.endsWith('/ip-region')) {
    const token = getToken(event)
    await requireAdmin({ token })
    const id = slug.replace('/ip-region', '')
    return handleIpRegionGet({ id })
  }

  // GET /api/comments — public list
  if (method === 'GET' && !slug) {
    const data = validateQuery(event, GetCommentSchema)
    return handleCommentGet(data)
  }

  // POST /api/comments — submit a new comment
  if (method === 'POST' && !slug) {
    const data = await validateBody(event, SubmitCommentSchema)
    return handleCommentSubmit({ ...data, _ip: await getClientIp(buildRequestContext(event)), token: getToken(event), event })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
