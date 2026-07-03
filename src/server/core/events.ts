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

interface Listener {
  url: string
  send: (data: string) => void
  createdAt: number
}

const listeners = new Set<Listener>()

/** Broadcast a comment event to all connected clients watching the given URL */
export function notifyComment (url: string, event: string, payload: any) {
  const data = JSON.stringify({ event, url, ...payload })
  for (const listener of listeners) {
    if (listener.url === url || listener.url === '*') {
      listener.send(`data: ${data}\n\n`)
    }
  }
}

/**
 * Pure SSE business logic — framework-agnostic.
 * The `sink` (built by nitro's buildSSESink) handles response headers,
 * the underlying ReadableStream, and disconnect detection mechanism.
 */
export function runSSEStream (sink: SSESink, query: Record<string, string>) {
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
    console.warn(`[SSE] Cleaned up ${removed} stale listeners`)
  }
}, 60_000).unref()
