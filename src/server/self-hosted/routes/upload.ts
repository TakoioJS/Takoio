import { Hono } from 'hono'
import { handleUploadImage } from '../handlers/image'

export const uploadRoutes = new Hono()

// POST /api/upload — 上传图片
uploadRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json(await handleUploadImage({ image: body.image, _ip: c.req.header('x-forwarded-for') || '' }))
})
