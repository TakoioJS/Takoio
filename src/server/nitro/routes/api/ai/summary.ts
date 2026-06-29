/**
 * AI Summary — POST /api/ai/summary
 *
 * Accepts article content and returns AI-generated summary + keywords.
 * Requires admin authentication.
 */

import { handleArticleSummary } from '#core/handlers/summary'
import { requireAdmin } from '#core/auth'
// getToken — auto-imported from nitro/utils/

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  await requireAdmin({ token: getToken(event) })

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
})
