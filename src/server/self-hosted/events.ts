/**
 * Lightweight SSE (Server-Sent Events) hub for real-time comment notifications.
 * Clients connect via GET /api/events?channel=comments&url=/path
 * Server pushes events via the `notify` function.
 */

import type { Context } from 'hono'

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
export function handleSSEConnect (c: Context) {
  const url = c.req.query('url') || '*'

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

      // Cleanup on disconnect
      const cleanup = () => {
        clearInterval(keepAlive)
        listeners.delete(listener)
      }

      // Detect client disconnect via abort signal
      c.req.raw.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

/** Get current listener count (for diagnostics) */
export function getListenerCount () {
  return listeners.size
}
