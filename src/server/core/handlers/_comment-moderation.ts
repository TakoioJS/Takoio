/**
 * Comment Moderation Pipeline — 审核管道
 *
 * 将审核流程拆分为独立阶段，每个阶段可单独测试和替换。
 */

import type { CommentInput } from '../store/index'
import type { TakoioConfig } from '../config'
import { AppError } from '../config'
import { moderateComment, getAuditAction } from '../moderate'
import { logger } from '../utils/logger'
import { deserializeAIProviders } from '../config'

// ========== Types ==========

export interface ModerationContext {
  comment: CommentInput
  config: TakoioConfig
  ip?: string
  mail?: string
}

export interface RateLimitResult {
  allowed: boolean
  reason?: string
}

export interface SimilarityResult {
  maxSim: number
  isSpam: boolean
}

// ========== Stage 1: AI Moderation ==========

export async function runAiModeration (comment: CommentInput, cfg: TakoioConfig) {
  let aiEndpoint = ''
  let aiKey = ''
  let aiFormat = ''

  if (cfg.AUTO_AUDIT_METHOD === 'ai') {
    try {
      const providers = deserializeAIProviders(cfg.AI_PROVIDERS)
      const provider = providers.find(p => p.name === cfg.AUTO_AUDIT_AI_PROVIDER)
      if (provider) {
        aiEndpoint = provider.endpoint || ''
        aiKey = provider.key || ''
        aiFormat = provider.format || ''
      }
    } catch (e) {
      logger.warn('[moderation] Failed to parse AI providers:', e)
    }
  }

  return moderateComment(comment.comment, comment.nick, comment.link, {
    enabled: cfg.AUTO_AUDIT_METHOD === 'ai',
    endpoint: aiEndpoint,
    key: aiKey,
    model: cfg.AUTO_AUDIT_AI_MODEL,
    prompt: cfg.AUTO_AUDIT_AI_PROMPT,
    format: aiFormat,
    blockedKeywords: cfg.BLOCKED_KEYWORDS,
  })
}

// ========== Stage 2: Rate Limit ==========

const COMMENT_WINDOW_MAX = 3
const COMMENT_WINDOW_MS = 60_000

export async function checkRateLimit (
  _ip: string,
  mail: string | undefined,
  cfg: TakoioConfig,
  getRecentComments: (limit: number) => Promise<Array<{ ip?: string; mail?: string; created: number }>>
): Promise<RateLimitResult> {
  const limit = typeof cfg.COMMENT_RATE_LIMIT === 'number' ? cfg.COMMENT_RATE_LIMIT : 30000
  if (limit <= 0 || !_ip || _ip === 'unknown') {
    return { allowed: true }
  }

  const rawRecent = await getRecentComments(50)
  const myRecent = rawRecent.filter(c => c.ip === _ip || (mail && c.mail === mail))

  // Sliding window check
  const windowComments = myRecent.filter(c => Date.now() - c.created < COMMENT_WINDOW_MS)
  if (windowComments.length >= COMMENT_WINDOW_MAX) {
    return {
      allowed: false,
      reason: `评论太频繁，每 ${COMMENT_WINDOW_MS / 1000} 秒最多 ${COMMENT_WINDOW_MAX} 条`,
    }
  }

  // Per-comment interval check
  if (myRecent.length > 0 && Date.now() - myRecent[0].created < limit) {
    return { allowed: false, reason: '评论太频繁，请稍后再试' }
  }

  return { allowed: true }
}

// ========== Stage 3: Similarity Detection ==========

function getBigrams (str: string): Set<string> {
  const s = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2))
  return s
}

export function checkSimilarity (
  newComment: string,
  recentComments: Array<{ comment: string }>
): SimilarityResult {
  const setA = getBigrams(newComment)
  if (setA.size === 0) return { maxSim: 0, isSpam: false }

  let maxSim = 0
  for (const c of recentComments.slice(0, 20)) {
    const setB = getBigrams(c.comment)
    if (setB.size === 0) continue

    let intersection = 0
    for (const bg of setA) {
      if (setB.has(bg)) intersection++
    }

    const union = setA.size + setB.size - intersection
    const sim = union === 0 ? 0 : intersection / union
    if (sim > maxSim) maxSim = sim
  }

  return { maxSim, isSpam: maxSim > 0.8 }
}

// ========== Stage 4: Audit Action ==========

export function determineAuditAction (
  modResult: Awaited<ReturnType<typeof moderateComment>>,
  similarity: SimilarityResult,
  auditMode: boolean
) {
  // Merge similarity results into moderation
  if (similarity.isSpam) {
    modResult.passed = false
    modResult.spam = true
    modResult.score = Math.max(modResult.score, 90)
    modResult.reasons.push('内容重复度过高，涉嫌灌水')
    if (modResult.source === 'none') modResult.source = 'keyword'
  }

  const action = getAuditAction(modResult, auditMode ? 'audit' : 'pass')

  if (action === 'rejected') {
    logger.info({ source: modResult.source, score: modResult.score, reasons: modResult.reasons }, 'Comment rejected')
    throw new AppError('MODERATION_FAILED', '评论审核未通过，请修改后再试', 400)
  }

  return action
}

// ========== Pipeline Orchestrator ==========

export async function runModerationPipeline (
  ctx: ModerationContext,
  getRecentComments: (limit: number) => Promise<Array<{ ip?: string; mail?: string; created: number; comment: string }>>
) {
  // Stage 1: AI Moderation
  const modResult = await runAiModeration(ctx.comment, ctx.config)

  // Stage 2: Rate Limit
  const rateLimit = await checkRateLimit(ctx.ip || '', ctx.mail, ctx.config, getRecentComments)
  if (!rateLimit.allowed) {
    throw new AppError('RATE_LIMIT_EXCEEDED', rateLimit.reason || '请求过于频繁', 429)
  }

  // Stage 3: Similarity Detection
  const recent = await getRecentComments(20)
  const similarity = checkSimilarity(ctx.comment.comment, recent)

  // Stage 4: Determine Action
  const action = determineAuditAction(modResult, similarity, ctx.config.AUDIT_MODE)

  return { modResult, action }
}
