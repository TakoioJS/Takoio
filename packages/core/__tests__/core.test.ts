/**
 * @takoio/core 单元测试
 *
 * 覆盖：isUrl / classifyApiError / request (mock fetch) / timeago / API functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isUrl, classifyApiError, request } from '../src/api'
import { timeago } from '../src/timeago'

// =================================================================
// isUrl
// =================================================================
describe('isUrl', () => {
  it('returns true for http URLs', () => {
    expect(isUrl('http://example.com')).toBe(true)
  })

  it('returns true for https URLs', () => {
    expect(isUrl('https://example.com')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isUrl('')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(isUrl('not-a-url')).toBe(false)
  })

  it('returns false for protocol-less domains', () => {
    expect(isUrl('example.com')).toBe(false)
  })
})

// =================================================================
// classifyApiError
// =================================================================
describe('classifyApiError', () => {
  it('classifies AbortError as timeout', () => {
    const err = new DOMException('aborted', 'AbortError')
    expect(classifyApiError(err)).toBe('timeout')
  })

  it('classifies TakoioTimeoutError as timeout', () => {
    const err = new Error('请求超时')
    err.name = 'TakoioTimeoutError'
    expect(classifyApiError(err)).toBe('timeout')
  })

  it('classifies TypeError as network', () => {
    expect(classifyApiError(new TypeError('fetch failed'))).toBe('network')
  })

  it('classifies HTTP 429 as rate_limited', () => {
    expect(classifyApiError(new Error('HTTP 429'))).toBe('rate_limited')
  })

  it('classifies HTTP 500+ as server', () => {
    expect(classifyApiError(new Error('HTTP 503'))).toBe('server')
    expect(classifyApiError(new Error('HTTP 502'))).toBe('server')
  })

  it('classifies unknown errors as unknown', () => {
    expect(classifyApiError(new Error('something else'))).toBe('unknown')
    expect(classifyApiError('string error')).toBe('unknown')
    expect(classifyApiError(null)).toBe('unknown')
  })
})

// =================================================================
// request (mock fetch)
// =================================================================
describe('request', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('makes GET request and returns parsed JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: 'ok' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await request('https://example.com/api/test')
    expect(result).toEqual({ data: 'ok' })
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/test', expect.any(Object))
  })

  it('throws on non-ok response with message from body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ message: 'bad request' }),
    }))

    await expect(request('https://example.com/api/test')).rejects.toThrow('bad request')
  })

  it('throws with HTTP status fallback when body has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      json: async () => ({ }),
    }))

    await expect(request('https://example.com/api/test')).rejects.toThrow('Takoio: HTTP 403')
  })

  it('throws TakoioTimeoutError on abort', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(
      () => new Promise((_, reject) => {
        const err = new DOMException('aborted', 'AbortError')
        reject(err)
      })
    ))

    await expect(request('https://example.com/api/test')).rejects.toThrow('请求超时')
  })
})

// =================================================================
// timeago
// =================================================================
describe('timeago', () => {
  it('returns "just now" for timestamps that are in the future', () => {
    const future = Date.now() + 1000
    expect(timeago(future, Date.now())).toBe('刚刚')
  })

  it('returns minutes ago for recent timestamps', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const result = timeago(fiveMinAgo, Date.now())
    expect(result).toMatch(/分钟/)
  })

  it('returns hours ago', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
    const result = timeago(threeHoursAgo, Date.now())
    expect(result).toMatch(/小时/)
  })

  it('returns days ago', () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    const result = timeago(twoDaysAgo, Date.now())
    expect(result).toMatch(/天/)
  })

  it('accepts Date objects', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    const result = timeago(fiveMinAgo, Date.now())
    expect(result).toMatch(/分钟/)
  })

  it('handles exact current time', () => {
    const now = Date.now()
    const result = timeago(now, now)
    // diff=0 < MINUTE, future=false → returns "1 分钟前" (当前实现逻辑)
    expect(result).toMatch(/分钟/)
  })
})