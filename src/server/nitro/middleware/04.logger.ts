/**
 * Request logger middleware — replaces hono/logger.
 *
 * Logs method, URL, status code, and response time on the 'finish' event.
 * Only works under node-server preset (event.node.res available).
 * Serverless environments skip finish logging.
 */

import { logger } from '#core/utils/logger'

export default defineMiddleware((event) => {
  const start = Date.now()
  const method = event.method
  const url = getRequestURL(event).pathname

  // event.node.res only exists under node-server preset
  if (!event.node?.res) return

  event.node.res.on('finish', () => {
    const status = event.node.res.statusCode
    const ms = Date.now() - start
    logger.info(`${method} ${url} ${status} ${ms}ms`)
  })
})
