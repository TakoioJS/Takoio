/**
 * LRUCache tests.
 *
 * 重点覆盖：遍历清理场景不得使用 `get()`（会 delete+set 把 key 重新追加到 Map 尾部，
 * 迭代器再次访问 → 死循环卡死事件循环）。清理必须用 `peek()`。
 */
import { describe, it, expect } from 'vitest'
import { LRUCache } from '../lru-cache'

describe('LRUCache', () => {
  it('get() promotes key to most-recently-used', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // 'a' now most recent
    cache.set('c', 3) // evicts 'b' (oldest), not 'a'
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('peek() reads value without changing LRU order', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.peek('a')).toBe(1)
    cache.set('c', 3) // 'a' is still oldest → evicted
    expect(cache.peek('a')).toBeUndefined()
    expect(cache.peek('b')).toBe(2)
    expect(cache.peek('c')).toBe(3)
  })

  it('cleanup loop over keys() terminates and only removes expired entries (peek, not get)', () => {
    // 复刻 redis.ts 的清理模式：for...of keys() + 读值 + 删除过期项。
    // 用 get() 会死循环（每个未过期项被重新追加到尾部，迭代器无限访问）；
    // 用 peek() 不修改 Map 结构，遍历可正常终止。
    const cache = new LRUCache<string, { data: number; expire: number }>(1000)
    const now = Date.now()
    cache.set('expired-1', { data: 1, expire: now - 1000 })
    cache.set('live-1', { data: 11, expire: now + 60_000 })
    cache.set('expired-2', { data: 2, expire: now - 500 })
    cache.set('live-2', { data: 22, expire: now + 60_000 })

    // 加一个守卫：如果清理意外卡死，测试会因超时失败而不是无限挂起
    const finished = { value: false }
    const guard = setTimeout(() => {
      if (!finished.value) {
        throw new Error('cleanup loop did not terminate — infinite loop regression')
      }
    }, 2000)

    for (const k of cache.keys()) {
      const entry = cache.peek(k) // MUST be peek, not get
      if (entry && entry.expire < now) cache.delete(k)
    }
    finished.value = true
    clearTimeout(guard)

    expect(cache.size).toBe(2)
    expect(cache.peek('live-1')?.data).toBe(11)
    expect(cache.peek('live-2')?.data).toBe(22)
    expect(cache.peek('expired-1')).toBeUndefined()
    expect(cache.peek('expired-2')).toBeUndefined()
  })

  it('evicts oldest when exceeding maxSize', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3) // evicts 'a'
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })
})
