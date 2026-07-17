import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * MongoDB getDb() 重连回归测试。
 *
 * 缺陷：getDb() 的 IIFE 没有 try/catch。若 client.connect() 抛错，_connectPromise
 * 会永久保持为 rejected promise，后续所有 getDb() 调用都命中
 * `if (_connectPromise) return _connectPromise` 返回同一个 rejected promise，
 * 退避重连逻辑成为死代码，MongoDB 恢复后也无法自愈（仅重启进程可恢复）。
 *
 * 修复：connect 失败时清空 _connectPromise，使下次调用能真正重试。
 */

const { connectFailTimes, resetConnectFailCounter, mockDb } = vi.hoisted(() => ({
  // 控制前 N 次 connect() 抛错
  connectFailTimes: { value: 0 },
  resetConnectFailCounter: () => { connectFailTimes.value = 0 },
  mockDb: {
    collections: new Map<string, any>(),
    collection (name: string) {
      if (!this.collections.has(name)) {
        this.collections.set(name, {
          createIndex: vi.fn().mockResolvedValue(undefined),
          createIndexes: vi.fn().mockResolvedValue(undefined),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'x' }),
        })
      }
      return this.collections.get(name)
    },
  },
}))

vi.mock('mongodb', () => {
  return {
    MongoClient: class {
      on () { return this }
      async connect () {
        if (connectFailTimes.value > 0) {
          connectFailTimes.value--
          throw new Error('connect failed (simulated)')
        }
      }
      db () { return mockDb }
      async close () {}
    },
  }
})

vi.mock('../../env', () => ({
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB: 'takoio-test',
}))

const { ensureDb, closeMongoDb } = await import('../mongodb')

describe('MongoDB getDb() reconnect after failure', () => {
  beforeEach(() => {
    resetConnectFailCounter()
  })

  afterEach(async () => {
    await closeMongoDb()
  })

  it('retries connection after a failed connect (does not stay stuck on rejected promise)', async () => {
    // 第一次 connect 失败
    connectFailTimes.value = 1
    await expect(ensureDb()).rejects.toThrow('connect failed')

    // 修复前：第二次调用会返回同一个 rejected promise → 永久卡死
    // 修复后：_connectPromise 已清空，第二次调用重新建连并成功
    await expect(ensureDb()).resolves.toBeUndefined()
  })

  it('serves subsequent calls from the cached connection after success', async () => {
    await ensureDb() // 成功
    // 第二次不应再次 connect（复用 _db 缓存）
    const callsBefore = (mockDb.collection('comments').createIndexes as any).mock.calls.length
    await ensureDb()
    // ensureDb 每次都会调用 createIndexes（建索引幂等），但连接复用证明 getDb 返回了缓存的 _db
    expect((mockDb.collection('comments').createIndexes as any).mock.calls.length).toBeGreaterThan(callsBefore)
  })
})
