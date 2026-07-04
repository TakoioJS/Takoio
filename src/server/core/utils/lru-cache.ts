/**
 * Simple LRU cache backed by Map.
 *
 * Used by Redis fallback (store/redis.ts) and OAuth cache (store/oauth-cache.ts)
 * so they can share one implementation without cross-importing through redis.ts.
 */

export class LRUCache<K, V> {
  private cache = new Map<K, V>()
  constructor (private maxSize: number) {}

  get (key: K): V | undefined {
    const value = this.cache.get(key)
    if (value) {
      // 移动到最新
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set (key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 淘汰最旧的
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  delete (key: K): boolean {
    return this.cache.delete(key)
  }

  has (key: K): boolean {
    return this.cache.has(key)
  }

  keys (): IterableIterator<K> {
    return this.cache.keys()
  }

  get size (): number {
    return this.cache.size
  }
}
