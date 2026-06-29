/**
 * Health check — GET /health
 */

export default defineHandler(() => {
  return { status: 'ok', version: '1.0.0' }
})
