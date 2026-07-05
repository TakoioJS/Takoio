/**
 * Upload route — POST /api/upload
 *
 * IP extraction uses getClientIp() which respects trusted proxy config,
 * preventing IP spoofing via x-forwarded-for header.
 *
 * Rate limit: 10 uploads/IP/minute to prevent abuse.
 */

import { handleUploadImage, getClientIp, UploadImageSchema, redisRateLimit } from '#core'
import { buildRequestContext } from '../../../utils/request-context'
// validateBody — auto-imported from nitro/utils/ by Nitro

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  // Rate limit: 10 uploads per IP per minute
  const ip = await getClientIp(buildRequestContext(event))
  const allowed = await redisRateLimit(`upload:${ip}`, 10, 60 * 1000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: '上传过于频繁，请稍后再试' })
  }

  const data = await validateBody(event, UploadImageSchema)
  return handleUploadImage({
    image: data.image,
    _ip: ip,
  })
})
