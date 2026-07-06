/**
 * Lightweight SSE (Server-Sent Events) hub for real-time comment notifications.
 * Clients connect via GET /api/events?url=/path
 * Server pushes events via the `notifyComment` function.
 *
 * Migrated from Hono → H3 → SSESink port.
 * The h3-specific setResponseHeader/sendStream/disconnect-detection now live
 * in the nitro adapter (buildSSESink); core only consumes the SSESink port.
 */

import type { SSESink } from './ports'
import { MAX_LISTENERS, LISTENER_TIMEOUT_MS } from './constants'
import { logger } from './utils/logger'
import { REDIS_URL, SSE_MODE } from './env'

interface Listener {
  url: string
  send: (data: string) => void
  createdAt: number
}

const listeners = new Set<Listener>()
const SSE_REDIS_CHANNEL = 'takoio:events'

/** 内存模式：直接广播到本进程 listener */
function broadcastLocally (url: string, event: string, payload: any) {
  const data = JSON.stringify({ event, url, ...payload })
  for (const listener of listeners) {
    if (listener.url === url || listener.url === '*') {
      listener.send(`data: ${data}\n\n`)
    }
  }
}

/** Broadcast a comment event to all connected clients watching the given URL.
 *  Redis 模式下发布到频道，由订阅方本地转发；内存模式下直接进程内广播。 */
export async function notifyComment (url: string, event: string, payload: any) {
  if (SSE_MODE === 'redis' && REDIS_URL) {
    try {
      const { withRedis } = await import('./store/redis')
      const message = JSON.stringify({ url, event, payload })
      await withRedis(async (c) => { await c.publish(SSE_REDIS_CHANNEL, message); return true })
      return
    } catch (e: any) {
      logger.warn({ error: e.message }, '[SSE] Redis publish failed, falling back to memory broadcast')
    }
  }
  broadcastLocally(url, event, payload)
}

// ========== Redis pub/sub subscription for multi-instance SSE ==========

let _redisSubscriber: any = null
let _subscriberPromise: Promise<void> | null = null

async function ensureRedisSubscriber (): Promise<void> {
  if (_redisSubscriber || !REDIS_URL || SSE_MODE !== 'redis') return
  if (_subscriberPromise) return _subscriberPromise

  _subscriberPromise = (async () => {
    try {
      const Redis = (await import('ioredis')).default
      const client = new Redis(REDIS_URL)
      client.on('message', (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message)
          if (parsed.url && parsed.event) {
            broadcastLocally(parsed.url, parsed.event, parsed.payload)
          }
        } catch (e: any) {
          logger.warn({ error: e.message }, '[SSE] Invalid Redis message')
        }
      })
      await client.subscribe(SSE_REDIS_CHANNEL)
      _redisSubscriber = client
      logger.info('[SSE] Redis pub/sub subscriber connected')
    } catch (e: any) {
      logger.warn({ error: e.message }, '[SSE] Redis subscriber failed, falling back to memory mode')
    }
  })()

  return _subscriberPromise
}

/**
 * Pure SSE business logic — framework-agnostic.
 * The `sink` (built by nitro's buildSSESink) handles response headers,
 * the underlying ReadableStream, and disconnect detection mechanism.
 */
export async function runSSEStream (sink: SSESink, query: Record<string, string>) {
  // Redis 模式下提前启动订阅（失败已内部兜底）
  if (SSE_MODE === 'redis' && REDIS_URL) {
    await ensureRedisSubscriber().catch(() => {})
  }

  const url = query.url || '*'

  // Send initial connection event
  sink.write(`data: ${JSON.stringify({ event: 'connected', url })}\n\n`)

  const listener: Listener = { url, send: (data) => sink.write(data), createdAt: Date.now() }
  listeners.add(listener)

  // Enforce max listener limit
  if (listeners.size > MAX_LISTENERS) {
    const oldest = listeners.values().next().value
    if (oldest) {
      listeners.delete(oldest)
    }
  }

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    sink.write(': ping\n\n')
  }, 30_000)

  const cleanup = () => {
    clearInterval(keepAlive)
    listeners.delete(listener)
  }

  // Disconnect detection is delegated to the sink adapter (nitro layer),
  // which decides whether to use Node `req.on('close')` or Web `AbortSignal`.
  // Returns true if a real detector was wired up; false otherwise.
  const cleanupRegistered = sink.onDisconnect(cleanup)

  // Fallback: if the sink cannot detect disconnects (edge-case environments),
  // enforce a max lifetime to prevent memory leaks.
  if (!cleanupRegistered) {
    setTimeout(() => {
      clearInterval(keepAlive)
      listeners.delete(listener)
    }, LISTENER_TIMEOUT_MS)
  }
}

/** Clean up stale listeners */
export function cleanupStaleListeners (): number {
  const now = Date.now()
  let removed = 0
  for (const listener of listeners) {
    if (now - listener.createdAt > LISTENER_TIMEOUT_MS) {
      listeners.delete(listener)
      removed++
    }
  }
  return removed
}

/** Get current listener count (for diagnostics) */
export function getListenerCount () {
  return listeners.size
}

// Periodic cleanup every 60 seconds
setInterval(() => {
  const removed = cleanupStaleListeners()
  if (removed > 0) {
    logger.warn(`[SSE] Cleaned up ${removed} stale listeners`)
  }
}, 60_000).unref()
