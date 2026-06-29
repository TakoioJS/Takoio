const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase()

let _mongo: any = null
let _sqlite: any = null

async function getImpl () {
  if (DB_TYPE === 'mongodb') {
    if (!_mongo) _mongo = await import('./mongodb.js')
    return _mongo
  }
  if (!_sqlite) _sqlite = await import('./sqlite.js')
  return _sqlite
}

// Load implementation lazily; these re-export the selected backend's exports.
// Each consumer calls the function at module scope to get a live reference.
// The promise will resolve once on first call and cache thereafter.
const _load = (key: string) => getImpl().then(m => m[key])

/**
 * Wrap a Promise<value> into a thenable function.
 * - `await proxy.prop` resolves to the value (backward compatible)
 * - `proxy.prop(...args)` calls the resolved function and returns its Promise
 *
 * This is needed because the Proxy `get` trap returns a Promise, but consumers
 * write `store.method()` (call-then-await). Without this wrapper, calling a
 * Promise as a function throws "xxx is not a function".
 */
const makeThenable = (promise: Promise<any>): any => {
  const fn: any = (...args: any[]) => promise.then((f: any) => {
    if (typeof f !== 'function') throw new TypeError(`resolved value is not callable`)
    return f(...args)
  })
  // make the function itself await-able (so `await proxy.prop` still works for non-function values)
  fn.then = (onFulfilled?: any, onRejected?: any) => promise.then(onFulfilled, onRejected)
  fn.catch = (onRejected?: any) => promise.then(undefined, onRejected)
  return fn
}

// Store interfaces for Proxy typing

export interface CommentStore {
  addComment (data: any): Promise<any>
  getComment (id: string): Promise<any>
  updateComment (id: string, data: any): Promise<boolean>
  getComments (url: string, page?: number, pageSize?: number, sort?: string): Promise<{ data: any[]; total: number }>
  getReplies (pid: string): Promise<any[]>
  getCommentsCount (urls: string[]): Promise<{ url: string; count: number }[]>
  getRecentComments (limit?: number): Promise<any[]>
  getRawRecentComments (limit?: number): Promise<any[]>
  likeComment (id: string): Promise<boolean>
  dislikeComment (id: string): Promise<boolean>
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

// Dynamically resolved exports — resolved on first access per property.
// Each access returns a thenable function so consumers can write `store.method()`
// (call-then-await) as well as `await store.method` for non-function values.
export const commentStore = new Proxy({} as CommentStore, {
  get (_, prop) { return makeThenable(_load('commentStore').then(m => (m as any)[prop])) }
})
export const configStore = new Proxy({} as ConfigStore, {
  get (_, prop) { return makeThenable(_load('configStore').then(m => (m as any)[prop])) }
})
export const visitorStore = new Proxy({} as VisitorStore, {
  get (_, prop) { return makeThenable(_load('visitorStore').then(m => (m as any)[prop])) }
})
export const sessionStore = new Proxy({} as SessionStore, {
  get (_, prop) { return makeThenable(_load('sessionStore').then(m => (m as any)[prop])) }
})
export const reactionStore = new Proxy({} as ReactionStore, {
  get (_, prop) { return makeThenable(_load('reactionStore').then(m => (m as any)[prop])) }
})

export async function getStore () { return (await _load('getStore'))() as any }
export async function importStore (data: any) { return (await _load('importStore'))(data) as any }
export async function ensureDb () { return (await _load('ensureDb'))() as any }

// ponytail: in-memory rate limits, shared across all backends
const rateLimitMap = new Map<string, { timestamps: number[] }>()

// Periodic cleanup: remove stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 60000)
    if (entry.timestamps.length === 0) rateLimitMap.delete(ip)
  }
}, CLEANUP_INTERVAL).unref()

export const rateLimitStore = {
  checkRateLimit (ip: string, maxRequests = 60) {
    const now = Date.now()
    const entry = rateLimitMap.get(ip) || { timestamps: [] }
    entry.timestamps = entry.timestamps.filter(t => now - t < 60000)
    if (entry.timestamps.length >= maxRequests) {
      rateLimitMap.set(ip, entry)
      return false
    }
    entry.timestamps.push(now)
    rateLimitMap.set(ip, entry)
    return true
  },
}
