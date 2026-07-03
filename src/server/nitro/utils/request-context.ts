/**
 * Nitro-layer adapter — bridges h3 H3Event ↔ core's RequestContext / SSESink ports.
 *
 * All h3 framework calls (getRequestIP, getRequestHeader, getQuery,
 * setResponseHeader, sendStream, req.on('close'), AbortSignal) live HERE.
 * Core business logic consumes only the plain-data port interfaces.
 */

import { getRequestHeader, getRequestIP, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { setResponseHeader, sendStream } from 'h3'
import type { RequestContext, SSESink } from '#core'

/** Build a RequestContext from an H3Event (nitro layer adapter). */
export const buildRequestContext = (event: H3Event): RequestContext => {
  const headers: Record<string, string> = {}

  // H3's getRequestHeader supports case-insensitive lookup, but core expects
  // lowercased keys. We expose ALL incoming headers so that user-configured
  // IP_PROXY_HEADER (which may be any custom name) is available to core.
  // 1. Use getRequestHeader for the common proxy/origin headers (case-insensitive).
  // 2. Fall back to raw Node.js headers for any custom header names.
  const headerNames = [
    'origin', 'referer', 'host',
    'x-forwarded-for', 'x-real-ip',
    'cf-connecting-ip', 'x-vercel-forwarded-for', 'fly-client-ip',
  ]
  for (const name of headerNames) {
    const value = getRequestHeader(event, name)
    if (value) headers[name] = value
  }

  const rawHeaders = event.node?.req?.headers
  if (rawHeaders) {
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v
      else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(',')
    }
  }

  return {
    ip: getRequestIP(event, { xForwardedFor: false }) || '127.0.0.1',
    headers,
    method: event.method || 'GET',
    url: event.path || '',
    query: getQuery(event) as Record<string, string>,
    context: event.context,
  }
}

/** Build an SSESink from an H3Event (nitro layer adapter). */
export const buildSSESink = (event: H3Event): SSESink => {
  // SSE response headers — h3-specific, belong in the nitro layer.
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no') // Disable nginx buffering

  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start (c) {
      controller = c
    },
  })

  // Send stream to client — h3 owns the HTTP response.
  sendStream(event, stream)

  const onDisconnectCallbacks: (() => void)[] = []
  let cleanupRegistered = false

  // Disconnect detection:
  // 1. node-server preset: event.node.req 'close' event
  // 2. serverless: try the original Request's AbortSignal (if available)
  if (event.node?.req) {
    event.node.req.on('close', () => {
      for (const fn of onDisconnectCallbacks) {
        try { fn() } catch { /* ignore */ }
      }
    })
    cleanupRegistered = true
  } else if ('request' in event && (event as unknown as { request?: { signal?: AbortSignal } }).request?.signal) {
    ;(event as unknown as { request: { signal: AbortSignal } }).request.signal.addEventListener('abort', () => {
      for (const fn of onDisconnectCallbacks) {
        try { fn() } catch { /* ignore */ }
      }
    })
    cleanupRegistered = true
  }

  return {
    write (data: string) {
      try {
        controller?.enqueue(encoder.encode(data))
      } catch { /* client disconnected */ }
    },
    onDisconnect (cleanup: () => void) {
      onDisconnectCallbacks.push(cleanup)
      return cleanupRegistered
    },
  }
}
