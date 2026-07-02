/**
 * Store facade — lazy-loads the selected backend (sqlite or mongodb).
 *
 * ponytail: replaced Proxy+makeThenable with simple async init.
 * Consumers already write `await store.method()`, so a plain object works.
 */

import type {
  Comment,
  CommentInput,
  CommentListItem,
  CommentUpdate,
  RawComment,
  CommentCount,
  DashboardStats,
  DashboardTrendItem,
  VisitorCount,
  ReactionMap,
  CommentReactionMap,
  PaginatedResult,
  StoreSnapshot,
  StoreImportData,
  CommentState,
  CommentSort,
} from './types'

export type {
  Comment,
  CommentInput,
  CommentListItem,
  CommentUpdate,
  RawComment,
  CommentCount,
  DashboardStats,
  DashboardTrendItem,
  VisitorCount,
  ReactionMap,
  CommentReactionMap,
  PaginatedResult,
  StoreSnapshot,
  StoreImportData,
  CommentState,
  CommentSort,
} from './types'

import { DB_TYPE } from '../env'
import { isServerless } from '../utils/serverless'

// Store interfaces for typing
// 注意：所有后端实现（sqlite.ts / mongodb.ts / 未来的 postgres.ts）
// 必须返回符合这些 interface 的数据，由 TS 编译器强制校验签名一致性。

export interface CommentStore {
  addComment (data: CommentInput): Promise<Comment>
  /** 批量插入评论（导入用），返回插入条数 */
  addComments (data: CommentInput[]): Promise<number>
  getComment (id: string): Promise<Comment | undefined>
  updateComment (id: string, data: CommentUpdate): Promise<boolean>
  getComments (url: string, page?: number, pageSize?: number, sort?: CommentSort): Promise<PaginatedResult<CommentListItem>>
  getReplies (pid: string): Promise<CommentListItem[]>
  getCommentsCount (urls: string[]): Promise<CommentCount[]>
  getRecentComments (limit?: number): Promise<CommentListItem[]>
  getRawRecentComments (limit?: number): Promise<RawComment[]>
  getCommentReactions (commentId: string): Promise<CommentReactionMap>
  toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<CommentReactionMap>
  setCommentState (id: string, state: CommentState): Promise<boolean>
  hideComment (id: string): Promise<boolean>
  showComment (id: string): Promise<boolean>
  deleteComment (id: string): Promise<boolean>
  setTop (id: string, isTop: boolean): Promise<boolean>
  setSpam (id: string, isSpam?: boolean): Promise<boolean>
  getDashboardStats (): Promise<DashboardStats>
  getDashboardTrend (days?: number): Promise<DashboardTrendItem[]>
  setCommentIpRegion (id: string, ipRegion: string): Promise<boolean>
  getAllComments (page?: number, pageSize?: number): Promise<PaginatedResult<Comment>>
  searchComments (page?: number, pageSize?: number, searchStr?: string, filter?: string): Promise<PaginatedResult<Comment>>
}

export interface ConfigStore {
  getConfig (): Promise<Record<string, unknown>>
  setConfig (key: string, value: unknown): Promise<void>
  setManyConfig (data: Record<string, unknown>): Promise<void>
  resetConfig (): Promise<void>
}

export interface VisitorStore {
  getVisitorCount (url: string, title?: string): Promise<VisitorCount>
}

export interface SessionStore {
  createToken (): Promise<string>
  validateToken (token: string): Promise<boolean>
  removeToken (token: string): Promise<void>
  rotateToken (oldToken: string): Promise<string | null>
  removeAllTokens (): Promise<void>
  cleanupSessions (): Promise<void>
}

export interface ReactionStore {
  getReactions (url: string): Promise<ReactionMap>
  toggleReaction (url: string, emoji: string, ip: string): Promise<ReactionMap>
}

/**
 * Store backend module shape — every backend (sqlite/mongodb/postgres)
 * must export these members. Enforces compile-time consistency across implementations.
 */
export interface StoreBackend {
  commentStore: CommentStore
  configStore: ConfigStore
  visitorStore: VisitorStore
  sessionStore: SessionStore
  reactionStore: ReactionStore
  getStore (): Promise<StoreSnapshot>
  importStore (data: StoreImportData): Promise<void>
  ensureDb (): Promise<void>
}

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

// Rate limiting — Redis when available, DB persistence for serverless, memory fallback.
// Layer: Redis (preferred) > DB (serverless/reliable) > Memory (last resort)
//
// serverless 环境下 Redis TLS 握手开销大（100-300ms），直接走 DB 持久化限流，
// 解决多实例独立计数的问题。内存限流作为兜底保留。

/** Check if Redis rate limiting should be skipped (serverless or Redis unavailable).
 *  Evaluated at runtime, not module-load time, to handle env var timing issues.
 */
async function shouldSkipRedisRateLimit (): Promise<boolean> {
  try { return isServerless() } catch { return false }
}

/** DB-based rate limit with sliding window.
 *  Uses the underlying Drizzle DB directly for cross-instance persistence.
 *  Falls back to memory limit if DB is unavailable.
 */
async function _dbRateLimit (key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs

  try {
    let fn: any
    if (DB_TYPE === 'mongodb') {
      fn = (await import('./mongodb')).dbRateLimit
    } else if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql' || DB_TYPE === 'pg') {
      fn = (await import('./postgres')).dbRateLimit
    } else {
      fn = (await import('./sqlite')).dbRateLimit
    }
    if (typeof fn === 'function') {
      return fn(key, maxRequests, windowMs, windowStart)
    }
  } catch {
    // Fall through to memory fallback
  }
  // DB unavailable — fall back to memory limit
  const { memoryRateLimit } = await import('./redis')
  return memoryRateLimit(key, maxRequests, windowMs)
}

export const rateLimitStore = {
  async checkRateLimit (ip: string, maxRequests = 60) {
    if (await shouldSkipRedisRateLimit()) {
      return _dbRateLimit(`global:${ip}`, maxRequests, 60_000)
    }
    const { redisRateLimit } = await import('./redis')
    return redisRateLimit(`global:${ip}`, maxRequests, 60_000)
  },
}
