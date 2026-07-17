import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * SSE listener keepAlive cleanup 回归测试。
 *
 * 缺陷：cleanupStaleListeners 只执行 listeners.delete()，不清理每个 listener 的
 * keepAlive setInterval，导致 30s ping 定时器泄漏（且未 .unref() 会阻止进程退出）。
 *
 * 修复：Listener 持有 cleanup 闭包，cleanupStaleListeners 调用它以 clearInterval。
 * 本测试验证：stale listener 被清理后，其 keepAlive 不再产生 ping 写入。
 */

vi.stubEnv('SSE_MODE', '')
vi.stubEnv('REDIS_URL', '')

const { runSSEStream, cleanupStaleListeners, getListenerCount } = await import('../events')

function makeSink () {
  const writes: string[] = []
  let disconnectCb: (() => void) | null = null
  return {
    writes,
    sink: {
      write: (data: string) => { writes.push(data) },
      // 返回 true 表示已挂接真实断开检测；这里不主动触发，模拟客户端长连接不断开
      onDisconnect: (cb: () => void) => { disconnectCb = cb; return true },
    },
    disconnect: () => { disconnectCb?.() },
  }
}

describe('SSE listener keepAlive cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanupStaleListeners()
  })

  it('cleanupStaleListeners clears the keepAlive interval (no ping after eviction)', async () => {
    const { sink, writes } = makeSink()
    await runSSEStream(sink, { url: '/p1' })
    // 初始 connected 事件
    expect(writes.length).toBe(1)

    // 推进 30s：keepAlive 应产生一次 ping，证明定时器在运行
    vi.advanceTimersByTime(30_000)
    const pingsBefore = writes.filter(w => w.startsWith(': ping')).length
    expect(pingsBefore).toBeGreaterThan(0)

    // 推进到超过 LISTENER_TIMEOUT_MS（5min，严格 >），listener 变为 stale
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000)
    const writesBeforeCleanup = writes.length

    // 清理 stale listener —— 应调用其 cleanup 清除 keepAlive
    const removed = cleanupStaleListeners()
    expect(removed).toBe(1)
    expect(getListenerCount()).toBe(0)

    // 再推进多个 ping 周期：keepAlive 已 clearInterval，不应有新写入
    vi.advanceTimersByTime(120_000)
    expect(writes.length).toBe(writesBeforeCleanup)
  })

  it('onDisconnect cleanup also clears keepAlive (no ping after client disconnect)', async () => {
    const { sink, writes, disconnect } = makeSink()
    await runSSEStream(sink, { url: '/p2' })
    vi.advanceTimersByTime(30_000)
    expect(writes.filter(w => w.startsWith(': ping')).length).toBeGreaterThan(0)

    // 客户端断开 —— sink.onDisconnect 注册的 cleanup 应清除 keepAlive
    disconnect()
    expect(getListenerCount()).toBe(0)

    const writesBefore = writes.length
    vi.advanceTimersByTime(120_000)
    expect(writes.length).toBe(writesBefore)
  })
})
