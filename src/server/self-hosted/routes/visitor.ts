import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { handleCounterGet, handleCounterUpdate } from '../handlers/counter'
import { CounterGetSchema } from '../schemas'

export const visitorRoutes = new Hono()

// GET /api/counter — 获取访客计数
visitorRoutes.get('/', zValidator('query', CounterGetSchema), async (c) => {
  const data = c.req.valid('query')
  return c.json(await handleCounterGet(data))
})

// POST /api/counter — 更新访客计数
visitorRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  return c.json(await handleCounterUpdate(body))
})
