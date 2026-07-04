/**
 * GET /api/auth/me — return current authenticated user (from JWT).
 */

import { getAuthUserFromRequest } from '#core'

export default defineHandler(async (event) => {
  const user = getAuthUserFromRequest(event)
  return { user }
})
