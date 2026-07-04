/**
 * POST /api/auth/logout — no-op (JWT is stateless).
 */

export default defineHandler(async () => {
  return { success: true }
})
