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
  /** 由 runSSEStream 在创建 cleanup 闭包后回填。 eviction 路径（超过 MAX_LISTENERS
   *  或 stale 清理）必须调用它，否则 listener 的 keepAlive setInterval 与
   *  sink 持有的 HTTP 连接都不会被释放，长期累积会导致 FD 耗尽（DoS）。 */
  cleanup?: () => void
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
let _subscriberReconnectTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 连接失效/关闭时重置订阅者状态，并按退避间隔重新建立订阅。
 * 原始实现在 subscribe 失败后把 _subscriberPromise 卡在 resolved 态且 _redisSubscriber 恒为 null，
 * 导致后续调用永远命中 `if (_subscriberPromise) return` 而再不重连——
 * Serverless 冻结 / 网络抖动后跨实例实时通知会静默失效。
 */
function resetRedisSubscriber (client?: any): void {
  // 仅当存在「另一个」活跃订阅者时才忽略本次重置，避免旧客户端事件误触发；
  // 初次连接尚未赋值 _redisSubscriber（为 null）时不应据此跳过，否则重置失效、
  // _subscriberPromise 卡在 resolved 态，订阅者再也不会重建。
  if (client && _redisSubscriber && client !== _redisSubscriber) return
  if (_redisSubscriber) {
    try { _redisSubscriber.removeAllListeners('message') } catch { /* ignore */ }
    try { _redisSubscriber.disconnect() } catch { /* ignore */ }
  }
  _redisSubscriber = null
  _subscriberPromise = null
  scheduleSubscriberReconnect()
}

function scheduleSubscriberReconnect (delayMs = 1000): void {
  if (_subscriberReconnectTimer) return // 退避重试已在进行，避免叠加定时器
  _subscriberReconnectTimer = setTimeout(() => {
    _subscriberReconnectTimer = null
    // 重置后重新建立订阅；若仍失败会在 ensureRedisSubscriber 内再次触发重连
    void ensureRedisSubscriber().catch(() => {})
  }, delayMs)
  // 退避定时器不应阻止进程优雅退出
  if (typeof _subscriberReconnectTimer.unref === 'function') _subscriberReconnectTimer.unref()
}

export async function ensureRedisSubscriber (): Promise<void> {
  if (_redisSubscriber || !REDIS_URL || SSE_MODE !== 'redis') return
  if (_subscriberPromise) return _subscriberPromise

  _subscriberPromise = (async () => {
    let client: any = null
    try {
      const Redis = (await import('ioredis')).default
      client = new Redis(REDIS_URL)
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
      // 连接异常/关闭后自动重置并触发退避重连，避免永久失效
      client.on('error', (err: any) => {
        logger.warn({ error: err?.message }, '[SSE] Redis subscriber connection error')
        resetRedisSubscriber(client)
      })
      client.on('end', () => {
        logger.warn('[SSE] Redis subscriber connection closed')
        resetRedisSubscriber(client)
      })
      await client.subscribe(SSE_REDIS_CHANNEL)
      _redisSubscriber = client
      logger.info('[SSE] Redis pub/sub subscriber connected')
    } catch (e: any) {
      logger.warn({ error: e?.message }, '[SSE] Redis subscriber failed, falling back to memory mode')
      resetRedisSubscriber(client)
    }
  })()

  return _subscriberPromise
}

/** 优雅关闭 SSE 订阅者（测试 / 进程退出时调用），防止连接泄漏 */
export async function closeSseSubscriber (): Promise<void> {
  if (_subscriberReconnectTimer) {
    clearTimeout(_subscriberReconnectTimer)
    _subscriberReconnectTimer = null
  }
  if (_redisSubscriber) {
    try { _redisSubscriber.removeAllListeners('message') } catch { /* ignore */ }
    try { _redisSubscriber.disconnect() } catch { /* ignore */ }
  }
  _redisSubscriber = null
  _subscriberPromise = null
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

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    sink.write(': ping\n\n')
  }, 30_000)

  const cleanup = () => {
    clearInterval(keepAlive)
    listeners.delete(listener)
  }

  // 回填 cleanup 闭包：eviction 路径（MAX_LISTENERS / stale 清理）需要它来释放
  // keepAlive 定时器与 sink 持有的 HTTP 连接，否则被驱逐的 listener 仍会
  // 每 30s 写入已孤立的 sink，连接也永不关闭，最终 FD 耗尽。
  listener.cleanup = cleanup

  // Enforce max listener limit
  if (listeners.size > MAX_LISTENERS) {
    const oldest = listeners.values().next().value
    if (oldest) {
      // 关键：必须调用 oldest.cleanup() 而非只 listeners.delete(oldest)。
      // 只 delete 会留下 keepAlive setInterval 与未关闭的 HTTP 连接 → 资源泄漏。
      if (oldest.cleanup) oldest.cleanup()
      else listeners.delete(oldest)
    }
  }

  // Disconnect detection is delegated to the sink adapter (nitro layer),
  // which decides whether to use Node `req.on('close')` or Web `AbortSignal`.
  // Returns true if a real detector was wired up; false otherwise.
  const cleanupRegistered = sink.onDisconnect(cleanup)

  // Fallback: if the sink cannot detect disconnects (edge-case environments),
  // enforce a max lifetime to prevent memory leaks.
  if (!cleanupRegistered) {
    setTimeout(() => {
      cleanup()
    }, LISTENER_TIMEOUT_MS)
  }
}

/** Clean up stale listeners */
export function cleanupStaleListeners (): number {
  const now = Date.now()
  let removed = 0
  for (const listener of listeners) {
    if (now - listener.createdAt > LISTENER_TIMEOUT_MS) {
      // 关键：必须调用 listener.cleanup() 而非只 listeners.delete(listener)。
      // 只 delete 会留下 keepAlive setInterval 与未关闭的 HTTP 连接 → 资源泄漏。
      if (listener.cleanup) listener.cleanup()
      else listeners.delete(listener)
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
