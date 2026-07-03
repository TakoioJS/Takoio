/**
 * Store facade — lazy-loads the selected backend (sqlite or mongodb).
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

/** Runtime validation: ensure backend implements all required methods */
function validateBackend (impl: StoreBackend, backendName: string): void {
  const requiredStores: { name: string; methods: string[] }[] = [
    { name: 'commentStore', methods: ['addComment', 'getComment', 'updateComment', 'getComments', 'deleteComment'] },
    { name: 'configStore', methods: ['getConfig', 'setConfig'] },
    { name: 'sessionStore', methods: ['createToken', 'validateToken'] },
  ]

  for (const store of requiredStores) {
    const implStore = (impl as any)[store.name]
    if (!implStore) {
      throw new Error(`Backend "${backendName}" missing store: ${store.name}`)
    }
    for (const method of store.methods) {
      if (typeof implStore[method] !== 'function') {
        throw new Error(`Backend "${backendName}" store "${store.name}" missing method: ${method}()`)
      }
    }
  }
}

/** Initialize the store backend — called from Nitro init plugin */
export async function initStore (): Promise<void> {
  if (_initialized) return
  const impl = await getImpl()
  validateBackend(impl, DB_TYPE)
  Object.assign(commentStore, impl.commentStore)
  Object.assign(configStore, impl.configStore)
  Object.assign(visitorStore, impl.visitorStore)
  Object.assign(sessionStore, impl.sessionStore)
  Object.assign(reactionStore, impl.reactionStore)
  _initialized = true
}

/** 检查 store 是否已初始化 */
export function isStoreInitialized (): boolean {
  return _initialized
}

// Module-level store objects — populated by initStore(), used by all consumers
export const commentStore = {} as CommentStore
export const configStore = {} as ConfigStore
export const visitorStore = {} as VisitorStore
export const sessionStore = {} as SessionStore
export const reactionStore = {} as ReactionStore

// Direct async functions for one-off use (import, export, ensureDb)
export async function getStore (): Promise<StoreSnapshot> { return (await getImpl()).getStore() }
export async function importStore (data: StoreImportData): Promise<void> { return (await getImpl()).importStore(data) }
export async function ensureDb (): Promise<void> { return (await getImpl()).ensureDb() }

// 限流逻辑统一从 ./rate-limit re-export（Task 4.2 迁出，过渡期保留聚合入口）
export * from './rate-limit'
