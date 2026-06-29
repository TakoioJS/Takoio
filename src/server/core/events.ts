/**
 * Lightweight SSE (Server-Sent Events) hub for real-time comment notifications.
 * Clients connect via GET /api/events?url=/path
 * Server pushes events via the `notifyComment` function.
 *
 * Migrated from Hono: Context → H3Event.
 */

import { getQuery, setResponseHeader, sendStream } from 'h3'
import type { H3Event } from 'h3'

type Listener = { url: string; send: (data: string) => void }

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

      const listener: Listener = { url, send }
      listeners.add(listener)

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
      } else if ((event as any).request?.signal) {
        ;(event as any).request.signal.addEventListener('abort', cleanup)
      }
    },
  })

  return sendStream(event, stream)
}

/** Get current listener count (for diagnostics) */
export function getListenerCount () {
  return listeners.size
}
