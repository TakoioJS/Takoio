import * as sqlite from './sqlite'
import * as mongo from './mongodb'

const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase()
const impl = DB_TYPE === 'mongodb' ? mongo : sqlite

export const COMMENT_STATE = impl.COMMENT_STATE
export const commentStore = impl.commentStore
export const configStore = impl.configStore
export const visitorStore = impl.visitorStore
export const sessionStore = impl.sessionStore
export const reactionStore = impl.reactionStore
export const getStore = impl.getStore
export const importStore = impl.importStore
export const ensureDb = impl.ensureDb

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