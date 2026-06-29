/**
 * AI Chat — POST /api/ai/chat
 *
 * Public (no auth) endpoint for site visitors.
 * Accepts a question about a specific page URL, performs RAG search
 * against the knowledge base, and returns an AI-generated answer.
 *
 * Requires AI_KB_CHAT_ENABLED to be true.
 */

import { handleKnowledgeChat } from '#core/handlers/knowledge'
import { getConfig } from '#core/config'
import { createError } from 'h3'

export default defineHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const cfg = await getConfig()
  if (!cfg.AI_KB_CHAT_ENABLED || !cfg.AI_KB_ENABLED) {
    throw createError({ statusCode: 403, statusMessage: 'AI 对话功能未启用' })
  }

  const body = await readBody(event).catch(() => ({}))
  if (!body.question || typeof body.question !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing required field: question' })
  }

  // Rate limit: max 10 questions per minute per IP (simple in-memory)
  // In production, this should use Redis
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || 'unknown'

  return handleKnowledgeChat({
    question: body.question.slice(0, 2000), // limit question length
    url: body.url,
  })
})
