/**
 * Comment Submit — 评论提交（含审核、限流、通知）
 *
 * 主流程：校验 / 鉴权 / 限流 / 审核 / 持久化
 * 副作用（缓存失效 / SSE / 邮件 / 推送）已抽出至 comment-submit-side-effects.ts（Phase 3 Task 3.5）
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { SubmitCommentSchema } from '../schemas'
import type { SubmitCommentData } from '../schemas'
import { commentStore } from '../store/index'
import type { CommentInput } from '../store/index'
import { getConfig } from '../config'
import type { TakoioConfig } from '../config'
import type { AppError } from '../errors'
import { verifyCaptcha, requireAdmin } from '../auth'
import { lookupIpRegion } from '../ip-region'
import { renderComment } from '../utils/render'
import { logger } from '../utils/logger'
import { AppError as AppErrorClass } from '../errors'
import { verifyToken } from '../auth-social'
import { invalidateAfterSubmit, notifyAfterSubmit } from './comment-submit-side-effects'
import { COMMENT_WINDOW_MAX, COMMENT_WINDOW_MS, COMMENT_RATE_LIMIT_DEFAULT } from '../constants'

// ========== Stage 1: Validate + auth + CAPTCHA ==========

async function validateSubmit (data: SubmitCommentData & { _ip?: string }, cfg: TakoioConfig) {
  const validation = safeValidate(SubmitCommentSchema, data)
  if (!validation.success) throw new AppErrorClass('INVALID_INPUT', validation.error, 400)

  const { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken, token, isPrivate } = validation.data

  // Social auth: if token is provided but invalid, reject. Valid token auto-populates user info.
  let authUser = null
  if (token) {
    authUser = verifyToken(token)
    if (!authUser) {
      throw new AppErrorClass('AUTH_INVALID', '登录已过期，请重新登录', 401)
    }
    logger.info({ provider: authUser.provider, name: authUser.name }, 'Authenticated comment')
  }

  // 博主视角的 token 视为已认证身份：开启私密评论不需要 CAPTCHA 也允许
  // （避免已登录博主评论自己博客时反复验证）

  // Impersonation protection
  const masterNameLower = cfg.MASTER_NAME?.toLowerCase() || ''
  const nickLower = nick.toLowerCase()
  if ((masterNameLower && nickLower === masterNameLower) || (cfg.MASTER && mail === cfg.MASTER)) {
    logger.warn({ nick, mail: mail ? '[redacted]' : '', ip: data._ip }, 'Impersonation attempt blocked')
    throw new AppErrorClass('INVALID_INPUT', '提交失败，请检查输入信息', 400)
  }

  // CAPTCHA — skip if authenticated via social auth
  if (cfg.ENABLE_CAPTCHA && !authUser) {
    if (!captchaToken) throw new AppErrorClass('INVALID_CAPTCHA', '请完成人机验证', 400)
    await verifyCaptcha(captchaToken, cfg)
  }

  return { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken, token, isPrivate, authUser }
}

// ========== Stage 2: Rate limit (core infrastructure) ==========

async function moderateSubmit (newComment: CommentInput, cfg: TakoioConfig, _ip?: string, mail?: string) {
  const { commentStore: store } = await import('../store/index')
  const rawRecent = await store.getRawRecentComments(50)

  // Rate limit — sliding window: max 3 comments per IP per 60s window (constants from ../constants)
  const limit = typeof cfg.COMMENT_RATE_LIMIT === 'number' ? cfg.COMMENT_RATE_LIMIT : COMMENT_RATE_LIMIT_DEFAULT
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

// ========== Export ==========

export const handleCommentSubmit = async (data: SubmitCommentData & { _ip?: string; event?: any }): Promise<any> => {
  const _ip = data._ip
  const cfg = await getConfig()

  // 1. Validate
  const { url, nick, mail, link, comment, pid, rid, ua, image, title, authUser, isPrivate } = await validateSubmit(data, cfg)

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
    isPrivate: !!isPrivate,
    image: image || null,
    ipRegion: null,
    renderedComment: null,
  }

  // 3. Moderate (built-in)
  const modResult = await moderateSubmit(newComment, cfg, _ip, mail)

  // 4. Persist
  const saved = await persistSubmit(newComment, _ip)

  // 5. Send notifications (fire-and-forget) — email + push
  notifyAfterSubmit(saved, cfg)

  // 6. Invalidate comment list cache + SSE real-time notification
  await invalidateAfterSubmit(newComment.url, saved)

  return { data: saved, moderated: modResult }
}
