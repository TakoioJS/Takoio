/**
 * Root route — GET / and fallback
 */

export default defineHandler((event) => {
  if (event.method === 'GET' && getRequestURL(event).pathname === '/') {
    setResponseHeader(event, 'content-type', 'text/plain')
    return 'Takoio server is running (v1.0.0)'
  }
  throw createError({ statusCode: 404 })
})
