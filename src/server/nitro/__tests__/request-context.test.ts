/**
 * request-context adapter tests (Task 8.4.2)
 *
 * 测试 `src/server/nitro/utils/request-context.ts` 的 `buildRequestContext` 与
 * `buildSSESink` 适配函数。
 *
 * 隔离策略：
 * - request-context.ts 通过显式 import 调用 h3 函数（getRequestHeader /
 *   getRequestIP / getQuery / setResponseHeader / sendStream），用 vi.mock('h3')
 *   替换即可。
 * - 它只从 `#core` 引入类型（RequestContext / SSESink），运行时被擦除，无需 mock。
 * - 测试场景：
 *   - buildRequestContext：从 H3Event 提取 ip/headers/query/method/url
 *   - buildRequestContext：X-Forwarded-For 与常见 proxy 头处理
 *   - buildSSESink：write 方法调用 controller.enqueue
 *   - buildSSESink：onDisconnect 注册清理回调（node-server preset）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// ---------- h3 mock（用 vi.hoisted 确保 vi.mock 工厂可用） ----------
const { h3Mocks } = vi.hoisted(() => {
  return {
    h3Mocks: {
      getRequestHeader: vi.fn(),
      getRequestIP: vi.fn(() => '127.0.0.1'),
      getQuery: vi.fn(() => ({})),
      setResponseHeader: vi.fn(),
      sendStream: vi.fn(),
    },
  }
})

vi.mock('h3', () => h3Mocks)

import * as h3 from 'h3'
import { buildRequestContext, buildSSESink } from '../utils/request-context'

// ---------- 共享 mock event 工厂 ----------
function makeEvent (overrides: Record<string, any> = {}): H3Event {
  return {
    method: 'GET',
    path: '/api/comments',
    node: {
      req: {
        headers: {},
        on: vi.fn(),
        socket: { remoteAddress: '127.0.0.1' },
      },
      res: { statusCode: 200 },
    },
    context: { foo: 'bar' },
    ...overrides,
  } as unknown as H3Event
}

beforeEach(() => {
  vi.clearAllMocks()
  // 重置默认返回值
  h3Mocks.getRequestIP.mockReturnValue('127.0.0.1')
  h3Mocks.getQuery.mockReturnValue({})
  h3Mocks.getRequestHeader.mockReturnValue(undefined)
})

// =================================================================
// buildRequestContext
// =================================================================
describe('buildRequestContext', () => {
  it('extracts method/url/query/context from H3Event', () => {
    const event = makeEvent({
      method: 'POST',
      path: '/api/login',
      context: { requestId: 'abc-123' },
    })
    vi.mocked(h3.getQuery).mockReturnValueOnce({ foo: 'bar', page: '2' })

    const ctx = buildRequestContext(event)

    expect(ctx.method).toBe('POST')
    expect(ctx.url).toBe('/api/login')
    expect(ctx.query).toEqual({ foo: 'bar', page: '2' })
    expect(ctx.context).toBe((event as any).context)
    expect(ctx.context.requestId).toBe('abc-123')
  })

  it('extracts IP via h3 getRequestIP (xForwardedFor disabled)', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestIP).mockReturnValueOnce('203.0.113.5')

    const ctx = buildRequestContext(event)

    expect(ctx.ip).toBe('203.0.113.5')
    expect(h3.getRequestIP).toHaveBeenCalledWith(event, { xForwardedFor: false })
  })

  it('falls back to 127.0.0.1 when getRequestIP returns null', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestIP).mockReturnValueOnce(null as unknown as string)

    const ctx = buildRequestContext(event)

    expect(ctx.ip).toBe('127.0.0.1')
  })

  it('extracts common proxy headers via getRequestHeader (case-insensitive)', () => {
    const event = makeEvent()
    // 模拟 h3.getRequestHeader 返回常见 header 值
    vi.mocked(h3.getRequestHeader).mockImplementation((_evt, name) => {
      const map: Record<string, string> = {
        origin: 'https://example.com',
        referer: 'https://example.com/page',
        host: 'api.example.com',
        'x-forwarded-for': '203.0.113.5, 70.41.0.1',
        'x-real-ip': '203.0.113.5',
        'cf-connecting-ip': '203.0.113.5',
      }
      return map[name] || undefined
    })

    const ctx = buildRequestContext(event)

    expect(ctx.headers.origin).toBe('https://example.com')
    expect(ctx.headers.referer).toBe('https://example.com/page')
    expect(ctx.headers.host).toBe('api.example.com')
    expect(ctx.headers['x-forwarded-for']).toBe('203.0.113.5, 70.41.0.1')
    expect(ctx.headers['x-real-ip']).toBe('203.0.113.5')
    expect(ctx.headers['cf-connecting-ip']).toBe('203.0.113.5')
  })

  it('merges raw Node.js headers from event.node.req.headers (lowercased)', () => {
    const event = makeEvent({
      node: {
        req: {
          headers: {
            'X-Custom-Header': 'custom-value',
            'X-Forwarded-For': '1.2.3.4',
            'Array-Header': ['a', 'b'],
          },
          on: vi.fn(),
          socket: { remoteAddress: '127.0.0.1' },
        },
        res: { statusCode: 200 },
      },
    })

    const ctx = buildRequestContext(event)

    // 原始 headers 应被 lowercase 后合并
    expect(ctx.headers['x-custom-header']).toBe('custom-value')
    expect(ctx.headers['x-forwarded-for']).toBe('1.2.3.4')
    // 数组 header 应被 join(',')
    expect(ctx.headers['array-header']).toBe('a,b')
  })

  it('handles event.node.req being undefined (serverless edge case)', () => {
    const event = makeEvent({ node: undefined })

    const ctx = buildRequestContext(event)

    // 不应该 throw，ip 回退到 127.0.0.1
    expect(ctx.ip).toBe('127.0.0.1')
    expect(ctx.headers).toEqual({})
  })

  it('defaults method to GET and url to empty string when missing', () => {
    const event = makeEvent({ method: undefined, path: undefined })

    const ctx = buildRequestContext(event)

    expect(ctx.method).toBe('GET')
    expect(ctx.url).toBe('')
  })
})

// =================================================================
// buildSSESink
// =================================================================
describe('buildSSESink', () => {
  it('sets SSE response headers (Content-Type, Cache-Control, Connection, X-Accel-Buffering)', () => {
    const event = makeEvent()

    buildSSESink(event)

    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Content-Type', 'text/event-stream')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-cache')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Connection', 'keep-alive')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'X-Accel-Buffering', 'no')
  })

  it('calls sendStream to flush the ReadableStream to the client', () => {
    const event = makeEvent()

    buildSSESink(event)

    expect(h3.sendStream).toHaveBeenCalledWith(event, expect.any(ReadableStream))
  })

  it('write() encodes data as UTF-8 and enqueues to the stream controller', async () => {
    const event = makeEvent()

    const sink = buildSSESink(event)

    // ReadableStream 的 controller 在 start() 同步赋值，但需要 microtask tick 才生效
    await Promise.resolve()

    sink.write('data: hello\n\n')

    // 没有 throw 即说明 enqueue 成功（无断言可访问 controller）
    // 通过尝试读取 stream 验证 enqueue 是否生效
    const stream = vi.mocked(h3.sendStream).mock.calls[0][1] as ReadableStream<Uint8Array>
    const reader = stream.getReader()
    const { value } = await reader.read()
    expect(value).toBeInstanceOf(Uint8Array)
    const text = new TextDecoder().decode(value)
    expect(text).toBe('data: hello\n\n')
  })

  it('write() swallows errors after client disconnects (no throw)', async () => {
    const event = makeEvent()

    const sink = buildSSESink(event)
    await Promise.resolve()

    // 模拟 client disconnect — controller 已 closed
    // 通过 cancel stream 来模拟
    const stream = vi.mocked(h3.sendStream).mock.calls[0][1] as ReadableStream<Uint8Array>
    await stream.cancel()

    // 不应该 throw
    expect(() => sink.write('post-disconnect\n')).not.toThrow()
  })

  it('onDisconnect registers cleanup callback and returns true when node req available', () => {
    const event = makeEvent()

    const sink = buildSSESink(event)

    const cleanup = vi.fn()
    const registered = sink.onDisconnect(cleanup)

    expect(registered).toBe(true)
    // req.on 应被调用注册 'close' 事件
    expect((event as any).node.req.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('onDisconnect callback fires when req emits close event', () => {
    const event = makeEvent()

    const sink = buildSSESink(event)

    const cleanup = vi.fn()
    sink.onDisconnect(cleanup)

    // 捕获 close 回调并触发
    const onCalls = (event as any).node.req.on.mock.calls
    const closeCall = onCalls.find((c: any[]) => c[0] === 'close')
    expect(closeCall).toBeTruthy()
    closeCall[1]() // 模拟 req emit 'close'

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('onDisconnect supports multiple cleanup callbacks (all fire on disconnect)', () => {
    const event = makeEvent()

    const sink = buildSSESink(event)

    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()
    const cleanup3 = vi.fn()
    sink.onDisconnect(cleanup1)
    sink.onDisconnect(cleanup2)
    sink.onDisconnect(cleanup3)

    // 触发 close
    const onCalls = (event as any).node.req.on.mock.calls
    const closeCall = onCalls.find((c: any[]) => c[0] === 'close')
    closeCall[1]()

    expect(cleanup1).toHaveBeenCalledTimes(1)
    expect(cleanup2).toHaveBeenCalledTimes(1)
    expect(cleanup3).toHaveBeenCalledTimes(1)
  })

  it('onDisconnect swallows errors thrown by cleanup callbacks', () => {
    const event = makeEvent()

    const sink = buildSSESink(event)

    const throwingCleanup = vi.fn(() => {
      throw new Error('cleanup failed')
    })
    const goodCleanup = vi.fn()
    sink.onDisconnect(throwingCleanup)
    sink.onDisconnect(goodCleanup)

    // 触发 close — 第一个 cleanup throw，但第二个仍应被调用
    const onCalls = (event as any).node.req.on.mock.calls
    const closeCall = onCalls.find((c: any[]) => c[0] === 'close')
    expect(() => closeCall[1]()).not.toThrow()

    expect(throwingCleanup).toHaveBeenCalledTimes(1)
    expect(goodCleanup).toHaveBeenCalledTimes(1)
  })

  it('uses AbortSignal when event.node.req is unavailable (serverless fallback)', () => {
    const addEventListener = vi.fn()
    const signal = { addEventListener }
    // 模拟 serverless 环境：event.node 不存在，但 event.request.signal 可用
    const event = makeEvent({
      node: undefined,
      request: { signal },
    } as any)

    const sink = buildSSESink(event)

    const cleanup = vi.fn()
    const registered = sink.onDisconnect(cleanup)

    expect(registered).toBe(true)
    expect(addEventListener).toHaveBeenCalledWith('abort', expect.any(Function))

    // 触发 abort
    const abortCall = addEventListener.mock.calls[0][1]
    abortCall()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('returns false from onDisconnect when no disconnect detector available', () => {
    // 既无 node.req 也无 request.signal
    const event = makeEvent({ node: undefined, request: undefined } as any)

    const sink = buildSSESink(event)

    const cleanup = vi.fn()
    const registered = sink.onDisconnect(cleanup)

    expect(registered).toBe(false)
  })
})
