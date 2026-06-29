/**
 * Comment root routes — /api/comments (no sub-path)
 *
 * Handles GET and POST at the /api/comments base path.
 * Sub-paths (/:id, /count, /recent, etc.) are handled by [...slug].ts.
 */

import {
  handleCommentGet, handleCommentSubmit,
} from '#core/handlers/comment'
import { getClientIp } from '#core/utils/ip'
import { GetCommentSchema, SubmitCommentSchema } from '#core/schemas'

export default defineHandler(async (event) => {
  const method = event.method

  // GET /api/comments — list comments for a page
  if (method === 'GET') {
    const data = validateQuery(event, GetCommentSchema)
    return handleCommentGet(data)
  }

  // POST /api/comments — submit a new comment
  if (method === 'POST') {
    const data = await validateBody(event, SubmitCommentSchema)
    return handleCommentSubmit({ ...data, _ip: await getClientIp(event) })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
