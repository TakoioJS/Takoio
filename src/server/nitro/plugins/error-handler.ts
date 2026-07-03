/**
 * Global error handler — standardizes all error responses to:
 *   { error: { code: string, message: string, details?: any } }
 *
 * Catches:
 *   - AppError (business logic errors with explicit code/status)
 *   - createError (h3/nitro built-in errors)
 *   - Validation errors (Zod/input validation)
 *   - Unexpected errors (500 Internal Server Error)
 *
 * Runs as a Nitro plugin so it intercepts all thrown errors
 * before they reach the default h3 error handler.
 */

import { AppError } from '#core/config'
import { logger } from '#core/utils/logger'

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, context) => {
    // Already handled by a route handler — don't double-process
    if (context?.event?.handled) return

    const event = context?.event
    if (!event) return

    // Determine error shape
    let code: string
    let message: string
    let statusCode: number
    let details: any

    if (error instanceof AppError) {
      code = error.code
      message = error.message
      statusCode = error.statusCode
    } else if (error && typeof error === 'object' && 'statusCode' in error) {
      // h3 createError
      const h3Err = error as { statusCode: number; statusMessage?: string; message?: string }
      statusCode = h3Err.statusCode
      message = h3Err.statusMessage || h3Err.message || 'Unknown error'
      code = `HTTP_${statusCode}`
    } else if (error instanceof Error) {
      code = 'INTERNAL'
      message = '服务器内部错误'
      statusCode = 500
      if (process.env.NODE_ENV !== 'production') {
        details = { originalMessage: error.message, stack: error.stack?.split('\n').slice(0, 3) }
      }
      logger.error({ code, error: error.message }, 'Unhandled error')
    } else {
      code = 'INTERNAL'
      message = '服务器内部错误'
      statusCode = 500
    }

    // Override the response
    const body = { error: { code, message, ...(details ? { details } : {}) } }
    setResponseStatus(event, statusCode)
    setResponseHeader(event, 'Content-Type', 'application/json')
    event.node.res.end(JSON.stringify(body))
    event.handled = true
  })
})
