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
import { getClientIp } from '#core/utils/ip'
import { createError } from 'h3'

const chatBuckets = new Map<string, { count: number; reset: number }>()
const CHAT_RATE_MAX = 10
const CHAT_RATE_WINDOW = 60_000
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of chatBuckets) if (b.reset < now) chatBuckets.delete(k)
}, CHAT_RATE_WINDOW).unref()

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

  const ip = await getClientIp(event)
  const now = Date.now()
  const bucket = chatBuckets.get(ip)
  if (!bucket || bucket.reset < now) {
    chatBuckets.set(ip, { count: 1, reset: now + CHAT_RATE_WINDOW })
  } else if (++bucket.count > CHAT_RATE_MAX) {
    throw createError({ statusCode: 429, statusMessage: '请求过于频繁，请稍后再试' })
  }

  return handleKnowledgeChat({
    question: body.question.slice(0, 2000), // limit question length
    url: body.url,
  })
})
