/**
 * Serverless diagnostic health check — GET /api/health
 *
 * Lightweight: does NOT import or initialize the database.
 * Returns env var status for deployment debugging.
 */

export default defineHandler((event) => {
  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase()
  return {
    status: 'ok',
    runtime: 'serverless',
    dbType,
    mongoUri: !!process.env.MONGODB_URI,
    libsqlUrl: !!process.env.LIBSQL_URL,
    vercel: !!process.env.VERCEL,
  }
})
