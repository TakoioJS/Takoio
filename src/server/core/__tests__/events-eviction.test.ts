/**
 * SSE listener eviction regression tests (Fix #9).
 *
 * 关键不变量：当 listener 因超过 MAX_LISTENERS 或被 stale 清理驱逐时，
 * 必须调用其 cleanup 闭包（清 keepAlive setInterval + 从 listeners 移除 +
 * 让 sink 关闭底层 HTTP 连接）。旧实现只 listeners.delete(...)，
 * 导致 keepAlive 定时器持续每 30s 写入已孤立的 sink、HTTP 连接永不关闭，
 * 长期累积 → FD 耗尽（DoS）。
 *
 * 这里用 fake timers + 计数 setInterval 句柄的方式验证 cleanup 被调用。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 关闭 Redis 订阅路径，让 runSSEStream 走纯内存分支
vi.stubEnv('SSE_MODE', 'memory')
vi.stubEnv('REDIS_URL', '')

const { runSSEStream, cleanupStaleListeners, getListenerCount } = await import('../events')

/** 构造一个能记录所有 write 调用 + 控制是否注册 disconnect 检测的 fake sink */
function makeFakeSink (opts: { onDisconnectRegistered?: boolean } = {}): {
  sink: import('../ports').SSESink
  writes: string[]
  disconnectCbs: Array<() => void>
} {
  const writes: string[] = []
  const disconnectCbs: Array<() => void> = []
  const sink = {
    write: (data: string) => { writes.push(data) },
    onDisconnect: (cb: () => void) => {
      disconnectCbs.push(cb)
      return opts.onDisconnectRegistered ?? true
    },
  }
  return { sink, writes, disconnectCbs }
}

// 跨用例收集所有创建的 sink，便于 afterEach 统一触发 disconnect 清理，
// 避免前一个用例残留的 listener 污染下一个用例的 getListenerCount 断言。
const allSinks: Array<{ disconnectCbs: Array<() => void> }> = []

describe('SSE listener eviction invokes cleanup (Fix #9)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 触发所有 sink 的 disconnect cleanup，清空 listeners Set
    for (const s of allSinks) {
      for (const cb of s.disconnectCbs) {
        try { cb() } catch { /* ignore */ }
      }
    }
    allSinks.length = 0
    vi.useRealTimers()
  })

  it('eviction at MAX_LISTENERS boundary invokes the oldest listener cleanup', async () => {
    // 用动态 import 拿到当前 MAX_LISTENERS，避免硬编码
    const { MAX_LISTENERS } = await import('../constants')

    const createdSinks: Array<{ writes: string[]; disconnectCbs: Array<() => void> }> = []
    for (let i = 0; i < MAX_LISTENERS; i++) {
      const s = makeFakeSink()
      createdSinks.push(s)
      allSinks.push(s)
      await runSSEStream(s.sink, { url: `/p${i}` })
    }
    expect(getListenerCount()).toBe(MAX_LISTENERS)

    // 第 MAX_LISTENERS+1 个连接触发驱逐最旧的 listener
    const newest = makeFakeSink()
    allSinks.push(newest)
    await runSSEStream(newest.sink, { url: '/new' })
    expect(getListenerCount()).toBe(MAX_LISTENERS) // 驱逐后仍为上限

    // 被驱逐的最旧 listener 的 disconnect cleanup 必须已被调用一次：
    // 旧实现只 delete，cleanup 永不触发，导致 keepAlive setInterval 泄漏。
    // 推进 31s，看被驱逐 sink 是否还会再收到 ping 写入。
    const evictedWritesBefore = createdSinks[0].writes.length
    await vi.advanceTimersByTimeAsync(31_000)
    // 若 cleanup 已生效，被驱逐 sink 不会收到新的 ping 写入
    expect(createdSinks[0].writes.length).toBe(evictedWritesBefore)
  })

  it('cleanupStaleListeners invokes cleanup for aged listeners (regression: stale cleanup leaks interval)', async () => {
    // 用注册了 disconnect 检测的 sink：这样不会创建 fallback setTimeout（它会在
    // LISTENER_TIMEOUT_MS 后自行调用 cleanup，掩盖 stale 清理路径的 bug）。
    // 我们只通过手动 cleanupStaleListeners 触发驱逐，专注验证该路径会调用 cleanup。
    const { LISTENER_TIMEOUT_MS } = await import('../constants')
    const s = makeFakeSink({ onDisconnectRegistered: true })
    allSinks.push(s)
    await runSSEStream(s.sink, { url: '/stale' })
    expect(getListenerCount()).toBe(1)
    // 不触发 s.disconnectCbs（模拟客户端未断开、但 listener 已过期的场景）

    // 推进时间到超过 LISTENER_TIMEOUT_MS，再触发手动清理
    await vi.advanceTimersByTimeAsync(LISTENER_TIMEOUT_MS + 1)
    const removed = cleanupStaleListeners()
    expect(removed).toBe(1)
    expect(getListenerCount()).toBe(0)

    // 推进 31s，被清理的 sink 不应再收到 keepAlive ping（证明 setInterval 已清）
    const writesBefore = s.writes.length
    await vi.advanceTimersByTimeAsync(31_000)
    expect(s.writes.length).toBe(writesBefore)
  })
})
