/**
 * MongoDB getDb() reconnect 行为回归测试（P1-fix）。
 *
 * 关键不变量：当首次 `_client.connect()` 失败时，`_connectPromise` 必须被清理，
 * 使得下次 `getDb()` 调用能够重新创建 MongoClient 并尝试重连，
 * 而不是永久返回同一个 rejected promise。
 *
 * 触发场景：serverless 冷启动 / MongoDB 维护窗口 / 网络抖动 → 一次瞬时连接失败
 * 即导致实例永久不可用，必须重启进程才能恢复。
 *
 * 修复前：`_client.on('close', ...)` 因 connect() 抛出而不会注册，
 * `_connectPromise` 卡在 rejected 态；后续 `getDb()` 永远命中
 * `if (_connectPromise) return _connectPromise` 返回同一个 rejected promise，
 * 重连退避逻辑成死代码。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 必须在 mongodb.ts 之前 mock env，让 MONGODB_URI 有值
vi.mock('../../env', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    MONGODB_URI: 'mongodb://localhost:27017',
    MONGODB_DB: 'takoio-test',
  }
})

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }))

vi.mock('mongodb', () => {
  class FakeMongoClient {
    onCalls: Record<string, Function[]> = {}
    closed = false
    on (event: string, cb: Function) {
      (this.onCalls[event] ||= []).push(cb)
      return this
    }

    async connect () { await connectMock() }
    db () { return { _fakeDb: true, collection: () => fakeCollection } }
    async close () { this.closed = true }
  }

  const fakeCollection = {
    find: () => ({
      sort: () => ({
        limit: () => ({
          toArray: async () => [],
        }),
      }),
    }),
    findOne: async () => null,
    insertOne: async (doc: any) => ({ insertedId: doc._id }),
    countDocuments: async () => 0,
    aggregate: () => ({ toArray: async () => [] }),
  }

  return {
    MongoClient: FakeMongoClient,
    Db: class {},
    Collection: class {},
  }
})

import { closeMongoDb, commentStore } from '../mongodb'

describe('MongoDB getDb() reconnect after failed initial connect', () => {
  beforeEach(async () => {
    await closeMongoDb()
    connectMock.mockReset()
  })

  afterEach(async () => {
    await closeMongoDb()
  })

  it('retries connect() on subsequent call (does not return cached rejected promise)', async () => {
    // 两次 connect 都失败
    connectMock.mockRejectedValue(new Error('connection refused'))

    // 第一次调用：getDb() 内部 IIFE 失败，promise rejects
    await expect(commentStore.getRecentComments(1)).rejects.toThrow('connection refused')
    expect(connectMock).toHaveBeenCalledTimes(1)

    // 第二次调用：必须重新进入 IIFE 并再次尝试 connect()
    // 修复前：返回同一个 rejected promise，connectMock 仍然只被调用 1 次
    // 修复后：重新创建 MongoClient 并调用 connect()，connectMock 被调用 2 次
    await expect(commentStore.getRecentComments(1)).rejects.toThrow('connection refused')
    expect(connectMock).toHaveBeenCalledTimes(2)
  })

  it('recovers when MongoDB becomes available after an initial failure', async () => {
    // 第一次失败，第二次成功
    connectMock
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(undefined)

    // 首次失败
    await expect(commentStore.getRecentComments(1)).rejects.toThrow('connection refused')
    expect(connectMock).toHaveBeenCalledTimes(1)

    // 重连成功 — 不应抛出（带 1s 退避）
    await expect(commentStore.getRecentComments(1)).resolves.toBeDefined()
    expect(connectMock).toHaveBeenCalledTimes(2)
  })
})
