import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * SSE Redis 订阅者重连测试（PR #13 §3.1 修复）。
 *
 * 关键不变量：ensureRedisSubscriber 在 subscribe 失败 / 连接断开后，
 * 必须重置 _subscriberPromise 与 _redisSubscriber，使得后续调用能够
 * 重新创建订阅者，而不是永久停留在「已 resolved 但无订阅者」的死状态。
 */

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))

vi.mock('ioredis', () => {
  class FakeRedis {
    handlers: Record<string, Function[]> = {}
    subscribeCalled = false
    constructor () {
      createClientMock(this)
    }
    on (event: string, cb: Function) {
      (this.handlers[event] ||= []).push(cb)
      return this
    }
    subscribe () {
      this.subscribeCalled = true
      return Promise.resolve()
    }
    disconnect () {
      return Promise.resolve()
    }
    emit (event: string, ...args: any[]) {
      ;(this.handlers[event] || []).forEach((cb) => cb(...args))
    }
  }
  return { default: FakeRedis }
})

vi.stubEnv('SSE_MODE', 'redis')
vi.stubEnv('REDIS_URL', 'redis://localhost:6379')

const { ensureRedisSubscriber, closeSseSubscriber } = await import('../events')

/** 取最近一次构造出的 FakeRedis 实例（createClientMock 以 this 作为首个入参） */
function lastClient (): any {
  const calls = createClientMock.mock.calls
  return calls.length ? calls[calls.length - 1][0] : undefined
}

describe('SSE Redis subscriber reconnect', () => {
  beforeEach(async () => {
    await closeSseSubscriber() // 重置模块级单例状态与退避定时器
    createClientMock.mockClear()
  })

  afterEach(async () => {
    await closeSseSubscriber()
  })

  it('re-creates the subscriber after a failed subscribe (does not stay stuck)', async () => {
    // 第一次：subscribe 失败
    createClientMock.mockImplementationOnce((inst: any) => {
      inst.subscribe = () => Promise.reject(new Error('connection refused'))
    })
    // 不应抛出（内部已兜底）
    await expect(ensureRedisSubscriber()).resolves.toBeUndefined()
    // 失败后被重置；再次调用必须重新创建客户端（证明 _subscriberPromise 已清空）
    await ensureRedisSubscriber()
    expect(createClientMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('forwards a valid Redis message to local broadcast without throwing', async () => {
    await ensureRedisSubscriber()
    const inst = lastClient()
    expect(inst).toBeTruthy()
    expect(() =>
      inst.emit(
        'message',
        'takoio:events',
        JSON.stringify({ url: '/a', event: 'comment', payload: { ok: true } }),
      ),
    ).not.toThrow()
  })
})
