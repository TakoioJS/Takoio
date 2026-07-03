/**
 * Global error handler — replaces Hono's app.onError().
 *
 * Handles:
 * 1. AppError (business logic errors) → { message, code } with custom status
 * 2. H3Error (createError throws) → { message, errors? } with H3 status
 * 3. Unknown errors → 500 + generic message
 */

import { H3Error } from 'h3'
import { AppError } from '#core'
import { logger } from '#core'
import { isDev } from '#core'

export default defineErrorHandler((error, event) => {
  // AppError: business logic errors with structured codes
  if (error instanceof AppError) {
    setResponseStatus(event, error.statusCode)
    return { message: error.message, code: error.code }
  }

  // H3Error: thrown by createError (e.g. 404, 400 from validation)
  if (error instanceof H3Error) {
    setResponseStatus(event, error.statusCode)
    return {
      message: error.statusMessage || error.message,
      ...(error.data ? { errors: error.data } : {}),
    }
  }

  // Unknown: log and return generic 500
  if (isDev()) {
    logger.error({ error: error.message, stack: error.stack }, 'Unhandled API Error')
  } else {
    logger.error({ error: error.message }, 'Unhandled API Error')
  }
  setResponseStatus(event, 500)
  return { message: '服务器内部错误' }
})
