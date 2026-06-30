/**
 * Serverless diagnostic health check — GET /api/health
 *
 * Lightweight: does NOT import or initialize the database.
 * Returns minimal status for deployment debugging.
 */

export default defineHandler(() => {
  return { status: 'ok' }
})
