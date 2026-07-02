/**
 * Comment Submit — 评论提交（含审核、限流、通知）
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { SubmitCommentSchema } from '../schemas'
import type { SubmitCommentData } from '../schemas'
import { commentStore } from '../store/index'
import type { CommentInput } from '../store/index'
import { getConfig } from '../config'
import type { TakoioConfig, AppError } from '../config'
import { verifyCaptcha, requireAdmin } from '../auth'
import { lookupIpRegion } from '../ip-region'
import { renderComment } from '../utils/render'
import { invalidateCommentListCache } from '../store/redis'
import { logger } from '../utils/logger'
import { AppError as AppErrorClass } from '../config'
import { runPreSubmit, runPostSubmit } from '../plugins/pipeline'
import type { HookContext } from '../plugins/types'
import { createConfigProxy } from '../config-ns'

// ========== Stage 1: Validate + auth + CAPTCHA ==========

async function validateSubmit (data: SubmitCommentData & { _ip?: string }, cfg: TakoioConfig) {
  const validation = safeValidate(SubmitCommentSchema, data)
  if (!validation.success) throw new AppErrorClass('INVALID_INPUT', validation.error, 400)

  const { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken } = validation.data

  // Impersonation protection — silently reject if user tries to impersonate the master
  const masterNameLower = cfg.MASTER_NAME?.toLowerCase() || ''
  const nickLower = nick.toLowerCase()
  if ((masterNameLower && nickLower === masterNameLower) || (cfg.MASTER && mail === cfg.MASTER)) {
    // Do NOT call requireAdmin here — that would leak the fact that this nick/email belongs to the master.
    // Instead, silently reject with a generic error to avoid information disclosure.
    logger.warn({ nick, mail: mail ? '[redacted]' : '', ip: data._ip }, 'Impersonation attempt blocked')
    throw new AppErrorClass('INVALID_INPUT', '提交失败，请检查输入信息', 400)
  }

  // CAPTCHA
  if (cfg.ENABLE_CAPTCHA) {
    if (!captchaToken) throw new AppErrorClass('INVALID_CAPTCHA', '请完成人机验证', 400)
    await verifyCaptcha(captchaToken, cfg)
  }

  return { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken }
}

// ========== Stage 2: Rate limit (core infrastructure) ==========

async function moderateSubmit (newComment: CommentInput, cfg: TakoioConfig, _ip?: string, mail?: string) {
  const { commentStore: store } = await import('../store/index')
  const rawRecent = await store.getRawRecentComments(50)

  // Rate limit — sliding window: max 3 comments per IP per 60s window
  const COMMENT_WINDOW_MAX = 3
  const COMMENT_WINDOW_MS = 60_000
  const limit = typeof cfg.COMMENT_RATE_LIMIT === 'number' ? cfg.COMMENT_RATE_LIMIT : 30000
  if (limit > 0 && _ip && _ip !== 'unknown') {
    const myRecent = rawRecent.filter(c => c.ip === _ip || (mail && c.mail === mail))
    const windowComments = myRecent.filter(c => Date.now() - c.created < COMMENT_WINDOW_MS)
    if (windowComments.length >= COMMENT_WINDOW_MAX) {
      throw new AppErrorClass('RATE_LIMIT_EXCEEDED', `评论太频繁，每 ${COMMENT_WINDOW_MS / 1000} 秒最多 ${COMMENT_WINDOW_MAX} 条`, 429)
    }
    if (myRecent.length > 0 && Date.now() - myRecent[0].created < limit) {
      throw new AppErrorClass('RATE_LIMIT_EXCEEDED', '评论太频繁，请稍后再试', 429)
    }
  }

  // Audit mode — if enabled, set state to pending
  if (cfg.AUDIT_MODE) {
    newComment.state = 'pending'
  }

  return { passed: true }
}

// ========== Stage 3: Persist + enrich ==========

async function persistSubmit (newComment: CommentInput, _ip?: string) {
  if (_ip && _ip !== 'unknown') {
    try { newComment.ipRegion = await lookupIpRegion(_ip) } catch (e) {
      logger.warn('[comment-submit] IP region lookup failed:', e)
      newComment.ipRegion = ''
    }
  }
  try { newComment.renderedComment = await renderComment(newComment.comment) } catch (e) {
    logger.warn('[comment-submit] Comment rendering failed:', e)
  }
  return commentStore.addComment(newComment)
}

// ========== Stage 4: Notify (SSE only — pushoo/email are postSubmit plugins) ==========

function notifySubmit (saved: any, newComment: CommentInput, cfg: TakoioConfig, data: SubmitCommentData & { href?: string }) {
  // SSE real-time notification (core infrastructure)
  import('../events').then(({ notifyComment }) => {
    notifyComment(newComment.url, 'comment:new', {
      comment: { id: saved.id, nick: saved.nick, comment: saved.comment, created: saved.created, url: saved.url },
    })
  }).catch(e => logger.error('[comment-submit] SSE notify failed:', e))
}

// ========== Export ==========

export const handleCommentSubmit = async (data: SubmitCommentData & { _ip?: string; event?: any }): Promise<any> => {
  const _ip = data._ip
  const cfg = await getConfig()

  // 1. Validate
  const { url, nick, mail, link, comment, pid, rid, ua, image, title } = await validateSubmit(data, cfg)

  // 2. Build comment object
  const mailMd5 = mail ? crypto.createHash('sha256').update(mail.trim().toLowerCase()).digest('hex') : ''
  const newComment: CommentInput = {
    id: crypto.randomUUID(),
    url: url || '/',
    href: data.href || null,
    nick: nick.slice(0, 50),
    mail: mail || '',
    mailMd5,
    link: link || '',
    comment: comment.slice(0, cfg.COMMENT_LENGTH_MAX || 5000),
    ua: ua || '',
    ip: _ip || '',
    state: 'visible',
    created: Date.now(),
    updated: null,
    pid: pid || null,
    rid: rid || null,
    like: 0,
    dislike: 0,
    isSpam: false,
    isTop: false,
    isPinned: false,
    image: image || null,
    ipRegion: null,
    renderedComment: null,
  }

  // === Plugin Pipeline: preSubmit ===
  const hookCtx: HookContext = { event: data.event, ip: _ip || 'unknown', config: createConfigProxy(cfg) }
  const preResult = await runPreSubmit(newComment, hookCtx)
  if (!preResult.passed) {
    logger.info({ rejectedBy: preResult.rejectedBy, reason: preResult.reason }, 'Comment rejected by preSubmit pipeline')
    throw new AppErrorClass('MODERATION_FAILED', preResult.reason || '评论审核未通过', 400)
  }
  if (preResult.modifications) {
    Object.assign(newComment, preResult.modifications)
  }

  // 3. Moderate (built-in)
  const modResult = await moderateSubmit(newComment, cfg, _ip, mail)

  // 4. Persist
  const saved = await persistSubmit(newComment, _ip)

  // === Plugin Pipeline: postSubmit ===
  runPostSubmit(saved, hookCtx).catch(e =>
    logger.warn({ error: e.message }, '[pipeline] postSubmit async error')
  )

  // 5. Invalidate comment list cache for this url (retry up to 3 times)
  let cacheInvalidated = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await invalidateCommentListCache(newComment.url)
      cacheInvalidated = true
      break
    } catch (e) {
      logger.warn(`[comment-submit] Cache invalidation attempt ${attempt} failed:`, e)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 100 * attempt))
      }
    }
  }
  if (!cacheInvalidated) {
    logger.error('[comment-submit] Cache invalidation failed after 3 attempts — data may be stale')
  }

  // 6. Notify (fire-and-forget)
  notifySubmit(saved, newComment, cfg, { ...data, url, nick, mail, link, comment, pid, rid, ua, image, title })

  return { data: saved, moderated: modResult }
}
