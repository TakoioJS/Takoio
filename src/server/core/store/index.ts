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

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase()

// Lazy-loaded backend module — resolved once on first init, cached thereafter
let _impl: any = null

async function getImpl () {
  if (_impl) return _impl
  if (DB_TYPE === 'mongodb') {
    _impl = await import('./mongodb.js')
  } else {
    _impl = await import('./sqlite.js')
  }
  return _impl
}

/** Initialize the store backend — called from Nitro init plugin */
export async function initStore () {
  const impl = await getImpl()
  // Copy exports to module-level variables so consumers can use them directly
  Object.assign(commentStore, impl.commentStore)
  Object.assign(configStore, impl.configStore)
  Object.assign(visitorStore, impl.visitorStore)
  Object.assign(sessionStore, impl.sessionStore)
  Object.assign(reactionStore, impl.reactionStore)
}

// Store interfaces for typing
// 注意：所有后端实现（sqlite.ts / mongodb.ts / 未来的 postgres.ts）
// 必须返回符合这些 interface 的数据，由 TS 编译器强制校验签名一致性。

export interface CommentStore {
  addComment (data: CommentInput): Promise<Comment>
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

// Module-level store objects — populated by initStore(), used by all consumers
export const commentStore = {} as CommentStore
export const configStore = {} as ConfigStore
export const visitorStore = {} as VisitorStore
export const sessionStore = {} as SessionStore
export const reactionStore = {} as ReactionStore

// Direct async functions for one-off use (import, export, ensureDb)
export async function getStore (): Promise<StoreSnapshot> { return (await getImpl()).getStore() as StoreSnapshot }
export async function importStore (data: StoreImportData): Promise<void> { return (await getImpl()).importStore(data) }
export async function ensureDb (): Promise<void> { return (await getImpl()).ensureDb() }

// ponytail: unified rate limiting — Redis when available, in-memory fallback inside redis.ts
// redisRateLimit 内部已完整处理 Redis 不可用时的内存兜底（_memRateBuckets），
// 此处无需再维护重复的内存限流逻辑。
export const rateLimitStore = {
  async checkRateLimit (ip: string, maxRequests = 60) {
    const { redisRateLimit } = await import('./redis')
    return redisRateLimit(`global:${ip}`, maxRequests, 60_000)
  },
}
