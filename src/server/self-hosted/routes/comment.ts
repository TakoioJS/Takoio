import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { getClientIp } from '../utils/ip'
import { requireAdmin } from '../auth'
import {
  handleCommentGet, handleCommentSubmit, handleCommentUpdate,
  handleCommentLike, handleCommentDislike, handleCommentDelete,
  handleCommentHide, handleCommentGetAdmin, handleCommentSetTop, handleCommentSetSpam,
} from '../handlers/comment'
import { handleGetCommentsCount, handleGetRecentComments } from '../handlers/counter'
import { handleHiddenFieldsGet, handleIpRegionGet } from '../handlers/admin'
import {
  GetCommentSchema, SubmitCommentSchema,
  AdminCommentSchema, RecentCommentsSchema,
} from '../schemas'

const getToken = (c: any): string | null => {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const qToken = c.req.query('token')
  if (qToken) return qToken
  return null
}

export const commentRoutes = new Hono()

commentRoutes.get('/', zValidator('query', GetCommentSchema), async (c) => {
  const data = c.req.valid('query')
  return c.json(await handleCommentGet(data))
})

commentRoutes.post('/', zValidator('json', SubmitCommentSchema), async (c) => {
  const body = c.req.valid('json')
  return c.json(await handleCommentSubmit({ ...body, _ip: await getClientIp(c) }))
})

commentRoutes.get('/count', async (c) => {
  const raw = c.req.query('urls')
  const urls = raw ? raw.split(',') : []
  return c.json(await handleGetCommentsCount({ urls }))
})

commentRoutes.get('/recent', zValidator('query', RecentCommentsSchema), async (c) => {
  const { count } = c.req.valid('query')
  return c.json(await handleGetRecentComments({ count }))
})

commentRoutes.get('/hidden-fields', async (c) => {
  return c.json(await handleHiddenFieldsGet())
})

commentRoutes.get('/:id/ip-region', async (c) => {
  return c.json(await handleIpRegionGet({ id: c.req.param('id') }))
})

commentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await requireAdmin({ token: getToken(c) || body.token })
  return c.json(await handleCommentUpdate({ id, ...body }))
})

commentRoutes.post('/:id/like', async (c) => {
  return c.json(await handleCommentLike({ id: c.req.param('id') }))
})

commentRoutes.post('/:id/dislike', async (c) => {
  return c.json(await handleCommentDislike({ id: c.req.param('id') }))
})

commentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await requireAdmin({ token: getToken(c) })
  return c.json(await handleCommentDelete({ id }))
})

commentRoutes.patch('/:id/hide', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await requireAdmin({ token: getToken(c) || body.token })
  return c.json(await handleCommentHide({ id, hide: body.hide }))
})

commentRoutes.patch('/:id/top', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await requireAdmin({ token: getToken(c) || body.token })
  return c.json(await handleCommentSetTop({ id, isTop: body.isTop }))
})

commentRoutes.patch('/:id/spam', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  await requireAdmin({ token: getToken(c) || body.token })
  return c.json(await handleCommentSetSpam({ id }))
})

commentRoutes.get('/admin', async (c) => {
  await requireAdmin({ token: getToken(c) })
  const query = c.req.query()
  return c.json(await handleCommentGetAdmin({
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: query.search,
    filter: query.filter,
  }))
})
