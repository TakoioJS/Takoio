/**
 * Upload route — POST /api/upload
 *
 * IP extraction uses getClientIp() which respects trusted proxy config,
 * preventing IP spoofing via x-forwarded-for header.
 */

import { handleUploadImage } from '#core/handlers/image'
import { getClientIp } from '#core/utils/ip'
import { UploadImageSchema } from '#core/schemas'
// validateBody — auto-imported from nitro/utils/ by Nitro

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const data = await validateBody(event, UploadImageSchema)
  return handleUploadImage({
    image: data.image,
    _ip: await getClientIp(event),
  })
})
