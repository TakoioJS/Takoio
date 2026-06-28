/**
 * E2E API tests — verify core REST endpoints against a running server.
 */
import { test, expect, request as pwRequest } from '@playwright/test'

const API = '/api'

test.describe('Health & Root', () => {
  test('GET /health returns ok', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('GET / returns welcome text', async ({ request }) => {
    const res = await request.get('/')
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).toContain('Takoio')
  })
})

test.describe('Comments API', () => {
  test('GET /api/comments returns list', async ({ request }) => {
    const res = await request.get(`${API}/comments?url=/`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('POST /api/comments rejects empty body', async ({ request }) => {
    const res = await request.post(`${API}/comments`, { data: {} })
    expect(res.status()).toBe(422)
  })

  test('POST /api/comments submits a comment', async ({ request }) => {
    const res = await request.post(`${API}/comments`, {
      data: {
        url: '/',
        nick: 'E2E Tester',
        comment: 'This is an E2E test comment from Playwright',
        mail: 'e2e@test.com',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.data.nick).toBe('E2E Tester')
  })

  test('GET /api/comments/count returns counts', async ({ request }) => {
    const res = await request.get(`${API}/comments/count?urls=/`)
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/comments/recent returns recent comments', async ({ request }) => {
    const res = await request.get(`${API}/comments/recent?count=5`)
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Reactions API', () => {
  test('GET /api/reactions returns reactions', async ({ request }) => {
    const res = await request.get(`${API}/reactions?url=/`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('reactions')
  })

  test('POST /api/reactions toggles a reaction', async ({ request }) => {
    const res = await request.post(`${API}/reactions?url=/e2e-test`, {
      data: { emoji: '👍' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('reactions')
    expect(body).toHaveProperty('myReactions')
  })
})

test.describe('Counter API', () => {
  test('GET /api/counter returns visitor count', async ({ request }) => {
    const res = await request.get(`${API}/counter?url=/`)
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Admin API', () => {
  test('GET /api/admin/comments requires auth', async ({ request }) => {
    const res = await request.get(`${API}/admin/comments`)
    expect(res.status()).toBe(401)
  })

  test('CHECK_SETUP via legacy endpoint', async ({ request }) => {
    const res = await request.post('/', {
      data: { event: 'CHECK_SETUP' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.result).toBeDefined()
  })
})
