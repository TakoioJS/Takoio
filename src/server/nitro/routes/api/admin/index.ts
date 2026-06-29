/**
 * Admin root routes — /api/admin (no sub-path)
 *
 * The /api/admin base path has no direct endpoint — return 404.
 * Sub-paths (/setup, /login, /config, etc.) are handled by [...slug].ts.
 */

export default defineHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
