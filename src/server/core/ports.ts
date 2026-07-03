/**
 * Transport-layer ports (interfaces) — decouple core business logic from
 * the h3/Nitro framework.
 *
 * Built by `nitro/utils/request-context.ts` from an H3Event; consumed by
 * `core/utils/ip.ts`, `core/auth.ts`, `core/events.ts`.
 *
 * Design notes:
 * - `RequestContext` is a plain data record. It carries everything core
 *   needs to make per-request decisions (IP, headers, method, url, query,
 *   request-scoped cache via `context`).
 * - `SSESink` is a write-only sink. Core's `runSSEStream` only knows how to
 *   `write` SSE-formatted bytes and register an `onDisconnect` cleanup; the
 *   nitro adapter decides how those map to the underlying transport
 *   (Node `req.on('close')`, Web `AbortSignal`, etc.).
 */

/**
 * Transport-layer abstraction for request context.
 * Decouples core business logic from h3/Nitro framework.
 * Built by nitro/utils/request-context.ts from H3Event.
 */
export interface RequestContext {
  /** Direct connection IP (extracted by nitro from socket, NOT from X-Forwarded-For) */
  ip: string
  /** All relevant request headers, lowercased keys */
  headers: Record<string, string>
  /** HTTP method (GET/POST/PUT/DELETE/PATCH) */
  method: string
  /** Full request URL */
  url: string
  /** Query parameters (parsed from URL) */
  query: Record<string, string>
  /** Request-scoped context for caching (e.g. config cache) */
  context?: Record<string, any>
}

/**
 * Sink interface for SSE (Server-Sent Events) streaming.
 * Decouples core SSE business logic from h3's setResponseHeader/sendStream.
 */
export interface SSESink {
  /** Send raw data to the client (already SSE-formatted) */
  write(data: string): void
  /** Register a cleanup callback when client disconnects.
   *  Returns true if a real disconnect detector was wired up by the adapter
   *  (e.g. Node `req.on('close')` or Web `AbortSignal`); returns false if
   *  the sink cannot detect disconnects, in which case the caller should
   *  register a max-lifetime fallback (LISTENER_TIMEOUT_MS) to prevent
   *  listener leaks in edge-case environments. */
  onDisconnect(cleanup: () => void): boolean
}
