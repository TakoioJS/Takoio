/**
 * Lightweight SSE (Server-Sent Events) hub for real-time comment notifications.
 * Clients connect via GET /api/events?url=/path
 * Server pushes events via the `notifyComment` function.
 *
 * Migrated from Hono: Context → H3Event.
 */

import { getQuery, setResponseHeader, sendStream } from 'h3'
import type { H3Event } from 'h3'

interface Listener {
  url: string
  send: (data: string) => void
  createdAt: number
}

const listeners = new Set<Listener>()
const MAX_LISTENERS = 1000
const LISTENER_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/** Broadcast a comment event to all connected clients watching the given URL */
export function notifyComment (url: string, event: string, payload: any) {
  const data = JSON.stringify({ event, url, ...payload })
  for (const listener of listeners) {
    if (listener.url === url || listener.url === '*') {
      listener.send(`data: ${data}\n\n`)
    }
  }
}

/** SSE endpoint handler */
export function handleSSEConnect (event: H3Event) {
  const url = (getQuery(event).url as string) || '*'

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no') // Disable nginx buffering

  const stream = new ReadableStream({
    start (controller) {
      const encoder = new TextEncoder()
      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(data)) } catch { /* client disconnected */ }
      }

      // Send initial connection event
      send(`data: ${JSON.stringify({ event: 'connected', url })}\n\n`)

      const listener: Listener = { url, send, createdAt: Date.now() }
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
        send(': ping\n\n')
      }, 30_000)

      const cleanup = () => {
        clearInterval(keepAlive)
        listeners.delete(listener)
      }

      // Disconnect detection:
      // 1. node-server preset: event.node.req 'close' event
      // 2. serverless: try the original Request's AbortSignal (if available)
      if (event.node?.req) {
        event.node.req.on('close', cleanup)
      } else if ('request' in event && (event as unknown as { request?: { signal?: AbortSignal } }).request?.signal) {
        ;(event as unknown as { request: { signal: AbortSignal } }).request.signal.addEventListener('abort', cleanup)
      }
    },
  })

  return sendStream(event, stream)
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
