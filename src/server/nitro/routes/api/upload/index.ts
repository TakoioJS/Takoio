/**
 * Upload route — POST /api/upload
 *
 * IP extraction uses getClientIp() which respects trusted proxy config,
 * preventing IP spoofing via x-forwarded-for header.
 */

import { handleUploadImage } from '#core'
import { getClientIp } from '#core'
import { UploadImageSchema } from '#core'
import { buildRequestContext } from '../../../utils/request-context'
// validateBody — auto-imported from nitro/utils/ by Nitro

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const data = await validateBody(event, UploadImageSchema)
  return handleUploadImage({
    image: data.image,
    _ip: await getClientIp(buildRequestContext(event)),
  })
})
