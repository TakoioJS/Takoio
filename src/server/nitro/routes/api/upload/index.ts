/**
 * Upload route — POST /api/upload
 *
 * IP extraction uses getClientIp() which respects trusted proxy config,
 * preventing IP spoofing via x-forwarded-for header.
 */

import { handleUploadImage } from '#core/handlers/image'
import { getClientIp } from '#core/utils/ip'

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const body = await readBody(event).catch(() => ({}))
  return handleUploadImage({
    image: body.image,
    _ip: await getClientIp(event),
  })
})
