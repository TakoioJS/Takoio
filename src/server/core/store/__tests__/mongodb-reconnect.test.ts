import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * MongoDB getDb 重连测试 — 验证 P1-fix。
 *
 * 不变式：getDb() 在 client.connect() 失败后必须清理 _connectPromise，
 * 使后续调用能够按 _connectAttempts 退避重试，而不是永久命中
 * `if (_connectPromise) return _connectPromise` 返回缓存的 rejected promise。
 *
 * 这是 events.ts ensureRedisSubscriber 修复（见 events-subscriber.test.ts）
 * 的同类 bug —— 原始 getDb 实现遗漏了 catch 分支。触发场景：
 *   - 启动期 MongoDB 短暂不可达（docker-compose race、DNS 抖动）
 *   - 运行期 MongoDB 维护重启 / OOM / 网络中断后首次重连仍失败
 * 一旦命中，整个数据面将瘫痪直至进程重启。
 */

const { connectMock, closeMock, collectionMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  closeMock: vi.fn(),
  collectionMock: vi.fn(),
}))

vi.mock('mongodb', () => {
  class FakeMongoClient {
    handlers: Record<string, Function[]> = {}
    constructor (public uri: string, public opts: any) {}
    on (event: string, cb: Function) {
      (this.handlers[event] ||= []).push(cb)
      return this
    }
    async connect () { return connectMock(this) }
    async close () { return closeMock(this) }
    db () {
      // drizzle-orm 风格：db.collection(name) 返回集合句柄；client 用于 startSession
      return { collection: collectionMock, client: this }
    }
  }
  return { MongoClient: FakeMongoClient }
})

const { dbRateLimit, closeMongoDb } = await import('../mongodb')

describe('MongoDB getDb reconnect after failed connect', () => {
  beforeEach(async () => {
    await closeMongoDb()
    connectMock.mockReset()
    closeMock.mockReset()
    collectionMock.mockReset()
  })

  afterEach(async () => {
    await closeMongoDb()
  })

  it('retries on the next call after a failed connect (does not stay stuck)', async () => {
    // 第一次 connect 失败 — 模拟启动期 MongoDB 短暂不可达
    connectMock.mockRejectedValueOnce(new Error('connection refused'))
    // 第二次 connect 成功
    connectMock.mockResolvedValueOnce(undefined)
    // findOneAndUpdate 返回 { count: 1 }，dbRateLimit 应返回 true（1 <= maxRequests）
    collectionMock.mockReturnValue({
      findOneAndUpdate: async () => ({ count: 1 }),
    })

    // 第一次调用必须 reject（连接被拒）
    await expect(dbRateLimit('k', 10, 1000, Date.now())).rejects.toThrow('connection refused')

    // 第二次调用必须重试并成功 — 证明 _connectPromise 已被清理，未卡在 rejected 态
    await expect(dbRateLimit('k', 10, 1000, Date.now())).resolves.toBe(true)
    expect(connectMock).toHaveBeenCalledTimes(2)
  })

  it('closes the failed client to release its connection pool and listeners', async () => {
    const failedClients: any[] = []
    connectMock.mockImplementationOnce((inst: any) => {
      failedClients.push(inst)
      return Promise.reject(new Error('boom'))
    })
    connectMock.mockResolvedValueOnce(undefined)
    collectionMock.mockReturnValue({
      findOneAndUpdate: async () => ({ count: 1 }),
    })

    await expect(dbRateLimit('k', 10, 1000, Date.now())).rejects.toThrow('boom')
    await expect(dbRateLimit('k', 10, 1000, Date.now())).resolves.toBe(true)

    // 失败的 client 必须被 close() 以回收资源（连接池、监控定时器、事件监听）
    expect(closeMock).toHaveBeenCalledWith(failedClients[0])
  })
})
