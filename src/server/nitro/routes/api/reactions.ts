/**
 * Page-level reactions — GET/POST /api/reactions
 *
 * url comes from query parameter (not path).
 * Both endpoints call the same handlers as /api/comments/:id/reactions.
 */

import { handleReactionGet, handleReactionSubmit } from '#core/handlers/comment'
import { getClientIp } from '#core/utils/ip'

export default defineHandler(async (event) => {
  const url = (getQuery(event).url as string) || '/'
  const ip = await getClientIp(event)

  if (event.method === 'GET') {
    return handleReactionGet({ url, _ip: ip })
  }

  if (event.method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return handleReactionSubmit({ url, emoji: body.emoji, _ip: ip })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
