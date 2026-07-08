/**
 * SSE endpoint mount — GET /api/events
 */

import { runSSEStream } from '#core'
import { buildRequestContext, buildSSESink } from '../../utils/request-context'

export default defineHandler(async (event) => {
  const sink = buildSSESink(event)
  const ctx = buildRequestContext(event)
  await runSSEStream(sink, ctx.query)
})
