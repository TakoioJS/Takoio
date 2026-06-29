/**
 * Knowledge base routes — /api/ai/knowledge/*
 *
 * Admin-only routes for managing article vector indexes and RAG chat.
 */

import {
  handleIndexArticle, handleDeleteArticle,
  handleKnowledgeChat, handleKnowledgeSearch,
  handleKnowledgeStatus,
} from '#core/handlers/knowledge'
import { requireAdmin } from '#core/auth'
// getToken, validateBody, validateQuery — auto-imported

export default defineHandler(async (event) => {
  const path = (event.context.params?.slug as string) || ''
  const segments = path.split('/').filter(Boolean)
  const method = event.method

  // ── GET /api/ai/knowledge/status ──
  if (segments[0] === 'status' && method === 'GET') {
    return handleKnowledgeStatus()
  }

  // All knowledge routes require admin auth
  await requireAdmin({ token: getToken(event) })

  // ── POST /api/ai/knowledge/index ──
  if (segments[0] === 'index' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return handleIndexArticle(body)
  }

  // ── DELETE /api/ai/knowledge/index ──
  if (segments[0] === 'index' && method === 'DELETE') {
    const query = getQuery(event)
    const url = query.url as string
    if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })
    return handleDeleteArticle(url)
  }

  // ── POST /api/ai/knowledge/chat ──
  if (segments[0] === 'chat' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return handleKnowledgeChat(body)
  }

  // ── POST /api/ai/knowledge/search ──
  if (segments[0] === 'search' && method === 'POST') {
    const body = await readBody(event).catch(() => ({}))
    return handleKnowledgeSearch(body)
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
