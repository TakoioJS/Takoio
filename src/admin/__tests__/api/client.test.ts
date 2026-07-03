// @vitest-environment jsdom
/**
 * API client tests (Task 8.5.2)
 *
 * 测试 `src/admin/api/client.ts` 的 401 拦截与 Bearer Token 注入逻辑。
 *
 * 隔离策略：
 * - mock `@takoio/common` 的 t 函数（返回 key 字符串便于断言）
 * - mock global fetch
 * - 提供 `useAuthStore` 全局（admin 用 unplugin-auto-import，运行时是全局符号），
 *   返回一个可控制的 mock auth store 对象
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ---------- mock @takoio/common ----------
vi.mock('@takoio/common', () => ({
  t: vi.fn((key: string) => key),
  setLanguage: vi.fn(),
}))

// ---------- mock auth store 作为全局符号 ----------
// admin/api/client.ts 通过 unplugin-auto-import 把 useAuthStore 当成全局符号使用，
// 不显式 import。测试时把 mock 直接挂到 globalThis 上。
const mockAuthStore = {
  token: '' as string,
  isAuthenticated: false,
  logout: vi.fn(),
}

;(globalThis as any).useAuthStore = () => mockAuthStore

// ---------- mock global fetch ----------
const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))
vi.stubGlobal('fetch', fetchMock)

import { api, setUnauthorizedHandler } from '../../api/client'
import { t } from '@takoio/common'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAuthStore.token = ''
  mockAuthStore.isAuthenticated = false
  mockAuthStore.logout.mockReset()
  fetchMock.mockReset()
})

// 辅助：构造 fetch 成功响应
function okResponse (data: any): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as unknown as Response
}

// 辅助：构造 fetch 错误响应
function errorResponse (status: number, data: any): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: async () => data,
  } as unknown as Response
}

// =================================================================
// Bearer Token 注入
// =================================================================
describe('Bearer Token injection', () => {
  it('injects Authorization: Bearer <token> when token is set', async () => {
    mockAuthStore.token = 'my-jwt-token'
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.get('/api/admin/config')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer my-jwt-token')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('skips Authorization header for /login URL even when token is set', async () => {
    mockAuthStore.token = 'should-not-be-used'
    fetchMock.mockResolvedValueOnce(okResponse({ success: true }))

    await api.post('/api/admin/login', { password: 'x' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('skips Authorization header for /setup URL even when token is set', async () => {
    mockAuthStore.token = 'should-not-be-used'
    fetchMock.mockResolvedValueOnce(okResponse({ success: true }))

    await api.get('/api/admin/setup')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('omits Authorization header entirely when token is empty', async () => {
    mockAuthStore.token = ''
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.get('/api/comments')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('always sets Content-Type: application/json', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.get('/api/comments')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('merges custom caller headers (does not override Content-Type by accident)', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.post('/api/comments', { foo: 'bar' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ foo: 'bar' }))
  })
})

// =================================================================
// 401 拦截
// =================================================================
describe('401 interception', () => {
  it('calls auth.logout() when response status is 401', async () => {
    mockAuthStore.token = 'expired-token'
    fetchMock.mockResolvedValueOnce(errorResponse(401, { message: 'token expired' }))

    await expect(api.get('/api/admin/config')).rejects.toThrow('token expired')

    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
  })

  it('invokes _onUnauthorized handler registered via setUnauthorizedHandler', async () => {
    mockAuthStore.token = 'expired-token'
    fetchMock.mockResolvedValueOnce(errorResponse(401, { message: 'unauthorized' }))

    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await expect(api.get('/api/admin/config')).rejects.toThrow('unauthorized')

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('throws ApiError with status=401 and data attached', async () => {
    mockAuthStore.token = 'expired-token'
    const errBody = { message: 'token expired', code: 'AUTH_EXPIRED' }
    fetchMock.mockResolvedValueOnce(errorResponse(401, errBody))

    let caught: any
    try {
      await api.get('/api/admin/config')
    } catch (e: any) {
      caught = e
    }

    expect(caught).toBeDefined()
    expect(caught.status).toBe(401)
    expect(caught.data).toEqual(errBody)
    expect(caught.message).toBe('token expired')
  })

  it('does NOT call logout for non-401 errors (e.g. 500)', async () => {
    mockAuthStore.token = 'tok'
    fetchMock.mockResolvedValueOnce(errorResponse(500, { message: 'server error' }))

    await expect(api.get('/api/admin/config')).rejects.toThrow('server error')

    expect(mockAuthStore.logout).not.toHaveBeenCalled()
  })
})

// =================================================================
// 网络错误
// =================================================================
describe('network error handling', () => {
  it('throws error with networkError message when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network down'))

    await expect(api.get('/api/comments')).rejects.toThrow('Network down')
  })

  it('throws Error with t("networkError") fallback when fetch rejects with non-Error value', async () => {
    // 非 Error 类型（如字符串）没有 .message 属性，应回退到 t('networkError')
    fetchMock.mockRejectedValueOnce('string-error')

    await expect(api.get('/api/comments')).rejects.toThrow('networkError')
    expect(t).toHaveBeenCalledWith('networkError')
  })

  it('preserves status-bearing errors thrown by 401/500 paths (no re-wrap)', async () => {
    mockAuthStore.token = 'tok'
    fetchMock.mockResolvedValueOnce(errorResponse(500, { message: 'boom' }))

    let caught: any
    try {
      await api.get('/api/comments')
    } catch (e: any) {
      caught = e
    }

    // error already has .status — should not be re-wrapped
    expect(caught.status).toBe(500)
    expect(caught.message).toBe('boom')
  })
})

// =================================================================
// 成功路径
// =================================================================
describe('successful response handling', () => {
  it('returns parsed JSON data on 200', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ data: [1, 2, 3] }))

    const result = await api.get('/api/comments')

    expect(result).toEqual({ data: [1, 2, 3] })
  })

  it('falls back to {} when response body is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('bad json') },
    } as unknown as Response)

    const result = await api.get('/api/comments')

    expect(result).toEqual({})
  })

  it('throws error with t("requestFailed") (status) message when !res.ok and no body message', async () => {
    mockAuthStore.token = 'tok'
    fetchMock.mockResolvedValueOnce(errorResponse(422, {}))

    await expect(api.get('/api/comments')).rejects.toThrow('requestFailed (422)')

    expect(t).toHaveBeenCalledWith('requestFailed')
  })

  it('uses body message when provided instead of t("requestFailed") fallback', async () => {
    mockAuthStore.token = 'tok'
    fetchMock.mockResolvedValueOnce(errorResponse(422, { message: '参数错误' }))

    await expect(api.get('/api/comments')).rejects.toThrow('参数错误')
  })
})

// =================================================================
// HTTP method helpers
// =================================================================
describe('api method helpers', () => {
  it('api.get builds query string from params (filters null/undefined)', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.get('/api/comments', { page: 1, url: '/x', skip: null, take: undefined })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('page=1')
    expect(url).toContain('url=%2Fx')
    expect(url).not.toContain('skip')
    expect(url).not.toContain('take')
  })

  it('api.get without params produces no query string', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.get('/api/comments')

    const [url] = fetchMock.mock.calls[0]
    expect(url).not.toContain('?')
  })

  it('api.post sends POST with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.post('/api/comments', { content: 'hi' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: 'hi' }))
  })

  it('api.post without body sends POST with undefined body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.post('/api/comments')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('api.put sends PUT with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.put('/api/admin/password', { password: 'new' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ password: 'new' }))
  })

  it('api.delete sends DELETE', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.delete('/api/comments/123')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('DELETE')
  })

  it('api.patch sends PATCH with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))

    await api.patch('/api/comments/123', { hidden: true })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ hidden: true }))
  })
})
