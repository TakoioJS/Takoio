/**
 * Store facade — lazy-loads the selected backend (sqlite / postgres / mongodb).
 *
 * ponytail: replaced Proxy+makeThenable with simple async init.
 * Consumers already write `await store.method()`, so a plain object works.
 */

// 类型与 Store 接口统一从 ./types re-export（Task 4.1 迁入）
export * from './types'

import { DB_TYPE } from '../env'

import type {
  StoreBackend,
  CommentStore,
  ConfigStore,
  VisitorStore,
  SessionStore,
  ReactionStore,
  UserStore,
  StoreSnapshot,
  StoreImportData,
} from './types'

let _impl: StoreBackend | null = null
let _initPromise: Promise<StoreBackend> | null = null
let _initialized = false

async function getImpl (): Promise<StoreBackend> {
  if (_impl) return _impl
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    if (DB_TYPE === 'mongodb') {
      _impl = await import('./mongodb.js') as StoreBackend
    } else if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql' || DB_TYPE === 'pg') {
      _impl = await import('./postgres.js') as StoreBackend
    } else {
      _impl = await import('./sqlite.js') as StoreBackend
    }
    return _impl
  })()

  return _initPromise
}

/** Initialize the store backend — called from Nitro init plugin */
export async function initStore (): Promise<void> {
  if (_initialized) return
  await getImpl()
  _initialized = true
}

/** 检查 store 是否已初始化 */
export function isStoreInitialized (): boolean {
  return _initialized
}

function createStoreProxy<T extends object> (name: keyof StoreBackend): T {
  return new Proxy({} as T, {
    get (_target, prop) {
      if (!_initialized || !_impl) {
        throw new Error(`Store "${name}" is not initialized. Call initStore() before using any store methods.`)
      }
      const store = (_impl as any)[name] as T
      const value = (store as any)[prop]
      if (typeof value === 'function') {
        return value.bind(store)
      }
      return value
    },
  })
}

// Module-level store proxies — delegate to the actual backend after initStore()
export const commentStore: CommentStore = createStoreProxy('commentStore')
export const configStore: ConfigStore = createStoreProxy('configStore')
export const visitorStore: VisitorStore = createStoreProxy('visitorStore')
export const sessionStore: SessionStore = createStoreProxy('sessionStore')
export const reactionStore: ReactionStore = createStoreProxy('reactionStore')
export const userStore: UserStore = createStoreProxy('userStore')

// Direct async functions for one-off use (import, export, ensureDb)
export async function getStore (): Promise<StoreSnapshot> { return (await getImpl()).getStore() }
export async function importStore (data: StoreImportData): Promise<void> { return (await getImpl()).importStore(data) }
export async function ensureDb (): Promise<void> { return (await getImpl()).ensureDb() }

// 限流逻辑统一从 ./rate-limit re-export（Task 4.2 迁出，过渡期保留聚合入口）
export * from './rate-limit'

/** 安全关闭数据库连接 — 用于优雅退出 */
export async function closeDb (): Promise<void> {
  try {
    if (DB_TYPE === 'mongodb') {
      return
    }
    const mod = DB_TYPE === 'postgres' || DB_TYPE === 'postgresql' || DB_TYPE === 'pg'
      ? await import('../db/pg-client.js')
      : await import('../db/client.js')
    if (typeof mod.closeDb === 'function') {
      await mod.closeDb()
    }
  } catch {
    // 关闭阶段的错误不做传播
  }
}
