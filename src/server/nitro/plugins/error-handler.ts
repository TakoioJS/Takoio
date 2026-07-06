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

import { AppError } from '#core'
import { logger } from '#core'

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
      // 内部异常详情仅记录服务端日志，绝不返回给客户端（包括开发环境）
      logger.error({ code, error: error.message, stack: error.stack }, 'Unhandled error')
    } else {
      code = 'INTERNAL'
      message = '服务器内部错误'
      statusCode = 500
    }

    // Override the response
    const body = { error: { code, message } }
    setResponseStatus(event, statusCode)
    setResponseHeader(event, 'Content-Type', 'application/json')
    event.node.res.end(JSON.stringify(body))
    event.handled = true
  })
})
