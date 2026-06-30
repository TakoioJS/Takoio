/**
 * Store facade — lazy-loads the selected backend (sqlite or mongodb).
 *
 * ponytail: replaced Proxy+makeThenable with simple async init.
 * Consumers already write `await store.method()`, so a plain object works.
 */

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

export interface CommentStore {
  addComment (data: any): Promise<any>
  getComment (id: string): Promise<any>
  updateComment (id: string, data: any): Promise<boolean>
  getComments (url: string, page?: number, pageSize?: number, sort?: string): Promise<{ data: any[]; total: number }>
  getReplies (pid: string): Promise<any[]>
  getCommentsCount (urls: string[]): Promise<{ url: string; count: number }[]>
  getRecentComments (limit?: number): Promise<any[]>
  getRawRecentComments (limit?: number): Promise<any[]>
  getCommentReactions (commentId: string): Promise<Record<string, { count: number, ips: string[] }>>
  toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<Record<string, { count: number, ips: string[] }>>
  setCommentState (id: string, state: string): Promise<boolean>
  hideComment (id: string): Promise<boolean>
  showComment (id: string): Promise<boolean>
  deleteComment (id: string): Promise<boolean>
  setTop (id: string, isTop: boolean): Promise<boolean>
  setSpam (id: string, isSpam?: boolean): Promise<boolean>
  getDashboardStats (): Promise<any>
  getDashboardTrend (days?: number): Promise<any>
  setCommentIpRegion (id: string, ipRegion: string): Promise<boolean>
  getAllComments (page?: number, pageSize?: number): Promise<{ data: any[]; total: number }>
  searchComments (page?: number, pageSize?: number, searchStr?: string, filter?: string): Promise<{ data: any[]; total: number }>
}

export interface ConfigStore {
  getConfig (): Promise<Record<string, any>>
  setConfig (key: string, value: any): Promise<void>
  setManyConfig (data: Record<string, any>): Promise<void>
  resetConfig (): Promise<void>
}

export interface VisitorStore {
  getVisitorCount (url: string, title?: string): Promise<any>
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
  getReactions (url: string): Promise<Record<string, string[]>>
  toggleReaction (url: string, emoji: string, ip: string): Promise<Record<string, string[]>>
}

// Module-level store objects — populated by initStore(), used by all consumers
export const commentStore = {} as CommentStore
export const configStore = {} as ConfigStore
export const visitorStore = {} as VisitorStore
export const sessionStore = {} as SessionStore
export const reactionStore = {} as ReactionStore

// Direct async functions for one-off use (import, export, ensureDb)
export async function getStore () { return (await getImpl()).getStore() as any }
export async function importStore (data: any) { return (await getImpl()).importStore(data) as any }
export async function ensureDb () { return (await getImpl()).ensureDb() as any }

// ponytail: unified rate limiting — Redis when available, in-memory fallback inside redis.ts
// redisRateLimit 内部已完整处理 Redis 不可用时的内存兜底（_memRateBuckets），
// 此处无需再维护重复的内存限流逻辑。
export const rateLimitStore = {
  async checkRateLimit (ip: string, maxRequests = 60) {
    const { redisRateLimit } = await import('./redis')
    return redisRateLimit(`global:${ip}`, maxRequests, 60_000)
  },
}
