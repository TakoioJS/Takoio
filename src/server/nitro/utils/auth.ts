/**
 * Auth token extraction — shared helper for route files.
 * Replaces the inline getToken() scattered across Hono route files.
 */

import { getRequestHeader } from 'h3'
import type { H3Event } from 'h3'

/** Extract Bearer token from Authorization header */
export const getToken = (event: H3Event): string | undefined => {
  const auth = getRequestHeader(event, 'authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}
