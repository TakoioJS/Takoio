/**
 * Page-level reactions — GET/POST /api/reactions
 *
 * url comes from query parameter (not path).
 * Both endpoints call the same handlers as /api/comments/:id/reactions.
 */

import { handleReactionGet, handleReactionSubmit } from '#core/handlers/comment'
import { getClientIp } from '#core/utils/ip'
import { ReactionGetSchema, ReactionSubmitSchema } from '#core/schemas'
// validateBody, validateQuery — auto-imported from nitro/utils/ by Nitro

export default defineHandler(async (event) => {
  const { url } = validateQuery(event, ReactionGetSchema)
  const ip = await getClientIp(event)

  if (event.method === 'GET') {
    return handleReactionGet({ url, _ip: ip })
  }

  if (event.method === 'POST') {
    const data = await validateBody(event, ReactionSubmitSchema)
    return handleReactionSubmit({ url: data.url || url, emoji: data.emoji, _ip: ip })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
