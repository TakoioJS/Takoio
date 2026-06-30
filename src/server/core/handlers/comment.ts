/**
 * Comment handlers — get, submit, update, like/dislike, delete, hide, admin, setTop, setSpam
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { notifyComment } from '../events'
import {
  GetCommentSchema,
  SubmitCommentSchema,
  CommentIdSchema,
  CommentActionSchema,
  UpdateCommentSchema,
  AdminCommentSchema,
  CounterGetSchema,
  CounterUpdateSchema,
  CommentsCountSchema,
  RecentCommentsSchema,
  ReactionGetSchema,
  ReactionSubmitSchema,
  CommentReactionGetSchema,
  CommentReactionSubmitSchema,
} from '../schemas'
import type {
  GetCommentData,
  SubmitCommentData,
  CommentIdData,
  CommentActionData,
  UpdateCommentData,
  AdminCommentData,
  ReactionGetData,
  ReactionSubmitData,
  CommentReactionGetData,
  CommentReactionSubmitData,
} from '../schemas'
import { commentStore, visitorStore, reactionStore } from '../store/index'
import { getConfig, maskSensitiveConfig } from '../config'
import { verifyCaptcha } from '../auth'
import { moderateComment, getAuditAction } from '../moderate'
import { sendNotification } from '../notify'
import { sendEmail } from '../email'
import { lookupIpRegion } from '../ip-region'
import { requireAdmin } from '../auth'
import { AppError } from '../config'
import { renderComment } from '../utils/render'

// ========== Helpers ==========

/** Mark comments whose nick or email matches the site master */
function markMasterComments (comments: any[], cfg: { MASTER?: string; MASTER_NAME?: string }) {
  const masterMailMd5 = cfg.MASTER ? crypto.createHash('md5').update(cfg.MASTER.trim().toLowerCase()).digest('hex') : ''
  const masterName = cfg.MASTER_NAME || ''
  const mark = (c: any) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
    if (c.children) c.children.forEach(mark)
  }
  comments.forEach(mark)
}

// ========== Comment Get ==========

export const handleCommentGet = async (data: GetCommentData) => {
  const validation = safeValidate(GetCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, page, pageSize, sort } = validation.data
  const result = await commentStore.getComments(url || '/', page, pageSize, sort)
  const rawCfg = await getConfig()

  markMasterComments(result.data, rawCfg)

  const cfg = maskSensitiveConfig(rawCfg)
  return { ...result, config: cfg }
}

// ========== Comment Submit ==========

// ========== Comment Submit Pipeline ==========

/** Stage 1: Validate + auth + CAPTCHA */
async function validateSubmit (data: SubmitCommentData & { _ip?: string }, cfg: TakoioConfig) {
  const validation = safeValidate(SubmitCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  const { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken } = validation.data

  // Impersonation protection
  if ((cfg.MASTER_NAME && nick === cfg.MASTER_NAME) || (cfg.MASTER && mail === cfg.MASTER)) {
    await requireAdmin(data)
  }

  // CAPTCHA
  if (cfg.ENABLE_CAPTCHA) {
    if (!captchaToken) throw new AppError('INVALID_CAPTCHA', '请完成人机验证', 400)
    await verifyCaptcha(captchaToken, cfg)
  }

  return { url, nick, mail, link, comment, pid, rid, ua, image, title, captchaToken }
}

/** Stage 2: Rate limit + spam detection + moderation */
async function moderateSubmit (newComment: any, cfg: TakoioConfig, _ip?: string, mail?: string) {
  const modResult = await runAiModeration(newComment, cfg)

  const rawRecent = await commentStore.getRawRecentComments(50)

  // 1. Rate limit
  const limit = typeof cfg.COMMENT_RATE_LIMIT === 'number' ? cfg.COMMENT_RATE_LIMIT : 30000
  if (limit > 0 && _ip && _ip !== 'unknown') {
    const myRecent = rawRecent.filter(c => c.ip === _ip || (mail && c.mail === mail))
    if (myRecent.length > 0 && Date.now() - myRecent[0].created < limit) {
      throw new AppError('RATE_LIMIT_EXCEEDED', '评论太频繁，请稍后再试', 429)
    }
  }

  // ponytail: O(n) bigram scan, acceptable for <10k comments; switch to bloom filter or precomputed hash if throughput matters
  // 2. 防灌水（相似度检测）
  const setA = getBigrams(newComment.comment)
  if (setA.size > 0) {
    let maxSim = 0
    for (const c of rawRecent.slice(0, 20)) {
      const setB = getBigrams(c.comment)
      if (setB.size === 0) continue
      let intersection = 0
      for (const bg of setA) { if (setB.has(bg)) intersection++ }
      const sim = setA.size + setB.size - intersection === 0 ? 0 : intersection / (setA.size + setB.size - intersection)
      if (sim > maxSim) maxSim = sim
    }
    if (maxSim > 0.8) {
      modResult.passed = false
      modResult.spam = true
      modResult.score = Math.max(modResult.score, 90)
      modResult.reasons.push('内容重复度过高，涉嫌灌水')
      if (modResult.source === 'none') modResult.source = 'keyword'
    }
  }

  const auditAction = getAuditAction(modResult, cfg.AUDIT_MODE ? 'audit' : 'pass')
  if (auditAction === 'rejected') {
    console.info({ source: modResult.source, score: modResult.score, reasons: modResult.reasons }, 'Comment rejected')
    throw new AppError('MODERATION_FAILED', '评论审核未通过，请修改后再试', 400)
  }
  if (auditAction === 'pending') newComment.state = 'pending'

  return modResult
}

/** AI moderation helper */
async function runAiModeration (newComment: any, cfg: TakoioConfig) {
  let aiEndpoint = ''
  let aiKey = ''
  let aiFormat = ''

  if (cfg.AUTO_AUDIT_METHOD === 'ai') {
    try {
      const providers = JSON.parse(cfg.AI_PROVIDERS || '[]')
      const provider = providers.find((p: any) => p.id === cfg.AUTO_AUDIT_AI_PROVIDER)
      if (provider) { aiEndpoint = provider.endpoint || ''; aiKey = provider.key || ''; aiFormat = provider.format || '' }
    } catch { /* ignore */ }
  }

  return moderateComment(newComment.comment, newComment.nick, newComment.link, {
    enabled: cfg.AUTO_AUDIT_METHOD === 'ai',
    endpoint: aiEndpoint, key: aiKey, model: cfg.AUTO_AUDIT_AI_MODEL,
    prompt: cfg.AUTO_AUDIT_AI_PROMPT, format: aiFormat, blockedKeywords: cfg.BLOCKED_KEYWORDS,
  })
}

/** Bigram helper for spam detection */
function getBigrams (str: string) {
  const s = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2))
  return s
}

/** Stage 3: Persist + enrich (IP region, render) */
async function persistSubmit (newComment: any, _ip?: string) {
  if (_ip && _ip !== 'unknown') {
    try { newComment.ipRegion = await lookupIpRegion(_ip) } catch { newComment.ipRegion = '' }
  }
  try { newComment.renderedComment = await renderComment(newComment.comment) } catch {}
  return commentStore.addComment(newComment)
}

/** Stage 4: Notifications (SSE, push, email) — fire-and-forget */
function notifySubmit (saved: any, newComment: any, cfg: TakoioConfig, data: SubmitCommentData & { href?: string }) {
  const { url, nick, mail, link, comment, pid, rid, ua, title } = data
  const _ip = newComment.ip
  const siteName = cfg.SITE_NAME || 'Takoio'

  // SSE
  notifyComment(newComment.url, 'comment:new', { comment: { id: saved.id, nick: saved.nick, comment: saved.comment, created: saved.created, url: saved.url } })

  // Push notification
  sendNotification(cfg, {
    title: `${nick} 评论了「${title || siteName}」`,
    content: `${nick} 在 ${title || siteName} 发表了评论：\n\n> ${comment.slice(0, 200)}${comment.length > 200 ? '...' : ''}`,
    siteName,
  }).catch(e => console.error({ error: e.message }, 'Notification failed'))

  // Email notifications
  if (cfg.ENABLE_MAIL_NOTIFICATION && cfg.SMTP_HOST) {
    const renderTpl = (tpl: string, vars: Record<string, string>) =>
      tpl.replace(/\{\{ (\w+) \}\}/g, (_, k: string) => vars[k] || `{{ ${k} }}`)

    // Reply notification
    if (rid || pid) {
      const parentId = rid || pid
      if (parentId) {
        commentStore.getComment(parentId).then(parentComment => {
          if (parentComment?.mail && parentComment.mail !== mail) {
            const vars = { siteName, nick: parentComment.nick, title: title || siteName, comment: comment.slice(0, 500), url: data.href || `https://your-site.com${url}` }
            sendEmail(cfg, renderTpl(cfg.MAIL_SUBJECT || '有人在 {title} 中回复了你', vars), renderTpl(cfg.MAIL_TEMPLATE || '', vars))
              .catch(e => console.error({ error: e.message }, 'Reply email failed'))
          }
        }).catch(() => {})
      }
    }

    // Admin notification
    if (cfg.SMTP_TO) {
      const adminVars = { siteName, nick, title: title || siteName, comment: comment.slice(0, 500), url: data.href || `https://your-site.com${url}`, ip: _ip || 'unknown', ua: ua || 'unknown' }
      sendEmail(cfg, renderTpl(cfg.MAIL_SUBJECT_ADMIN || '新的评论：{nick} 在 {title}', adminVars), renderTpl(cfg.MAIL_TEMPLATE_ADMIN || '', adminVars))
        .catch(e => console.error({ error: e.message }, 'Admin email failed'))
    }
  }
}

import type { TakoioConfig } from '../config'

export const handleCommentSubmit = async (data: SubmitCommentData & { _ip?: string }): Promise<any> => {
  const _ip = data._ip
  const cfg = await getConfig()

  // 1. Validate
  const { url, nick, mail, link, comment, pid, rid, ua, image, title } = await validateSubmit(data, cfg)

  // 2. Build comment object
  const mailMd5 = mail ? crypto.createHash('md5').update(mail.trim().toLowerCase()).digest('hex') : ''
  const newComment = {
    id: crypto.randomUUID(),
    url: url || '/', href: data.href || null,
    nick: nick.slice(0, 50), mail: mail || '', mailMd5, link: link || '',
    comment: comment.slice(0, cfg.COMMENT_LENGTH_MAX || 5000), ua: ua || '', ip: _ip || '',
    state: 'visible', created: Date.now(), updated: null as number | null,
    pid: pid || null, rid: rid || null, like: 0, dislike: 0, isSpam: false, isTop: false,
    image: image || null, ipRegion: null as string | null, renderedComment: null as string | null,
  }

  // 3. Moderate
  const modResult = await moderateSubmit(newComment, cfg, _ip, mail)

  // 4. Persist
  const saved = await persistSubmit(newComment, _ip)

  // 5. Notify (fire-and-forget)
  notifySubmit(saved, newComment, cfg, { ...data, url, nick, mail, link, comment, pid, rid, ua, image, title })

  return { data: saved, moderated: modResult }
}

// ========== Comment Update ==========

export const handleCommentUpdate = async (data: UpdateCommentData) => {
  const validation = safeValidate(UpdateCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { id, nick, mail, link, comment } = validation.data
  const mailMd5 = mail ? crypto.createHash('md5').update(mail.trim().toLowerCase()).digest('hex') : ''
  const renderedComment = comment ? await renderComment(comment).catch(() => null) : undefined
  await commentStore.updateComment(id, { nick, mail, mailMd5, link, comment, ...(renderedComment ? { renderedComment } : {}) })
  return { success: true }
}

// ========== Comment Reaction ==========

export const handleCommentReactionGet = async (data: CommentReactionGetData & { _ip?: string }) => {
  const { id } = data
  const ip = data._ip || 'unknown'
  const raw = await commentStore.getCommentReactions(id)
  return formatCommentReactions(raw, ip)
}

export const handleCommentReactionSubmit = async (data: CommentReactionSubmitData & { _ip?: string }) => {
  const { id, emoji } = data
  const ip = data._ip || 'unknown'
  const raw = await commentStore.toggleCommentReaction(id, emoji, ip)
  return formatCommentReactions(raw, ip)
}

function formatCommentReactions (raw: Record<string, { count: number, ips: string[] }>, ip: string) {
  const reactions: Record<string, number> = {}
  let myReaction: string | null = null
  for (const [emoji, info] of Object.entries(raw)) {
    if (info.ips.length > 0) {
      reactions[emoji] = info.count
      if (info.ips.includes(ip)) myReaction = emoji
    }
  }
  return { reactions, myReaction }
}

// ========== Comment Delete ==========

export const handleCommentDelete = async (data: CommentIdData) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { success: await commentStore.deleteComment(validation.data.id) }
}

// ========== Comment Hide ==========

export const handleCommentHide = async (data: CommentActionData) => {
  const validation = safeValidate(CommentActionSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  if (validation.data.hide) return { success: await commentStore.hideComment(validation.data.id) }
  return { success: await commentStore.showComment(validation.data.id) }
}

// ========== Comment Get (Admin) ==========

export const handleCommentGetAdmin = async (data: AdminCommentData) => {
  const validation = safeValidate(AdminCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { page, pageSize, search, filter } = validation.data
  let result
  if (search || (filter && filter !== 'all')) {
    result = await commentStore.searchComments(page, pageSize, search, filter)
  } else {
    result = await commentStore.getAllComments(page, pageSize)
  }

  const rawCfg = await getConfig()
  markMasterComments(result.data, rawCfg)

  return result
}

// ========== Comment Set Top ==========

export const handleCommentSetTop = async (data: CommentIdData & { isTop?: boolean }) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const isTop = data.isTop ?? true
  return { success: await commentStore.setTop(validation.data.id, isTop) }
}

// ========== Comment Set Spam ==========

export const handleCommentSetSpam = async (data: CommentIdData & { isSpam?: boolean }) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const isSpam = data.isSpam ?? true
  return { success: await commentStore.setSpam(validation.data.id, isSpam) }
}

// ========== Comment Approve (pending → visible) ==========

export const handleCommentApprove = async (data: CommentIdData) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { success: await commentStore.showComment(validation.data.id) }
}

// ========== Dashboard Stats ==========

export const handleDashboardStats = async () => {
  return await commentStore.getDashboardStats()
}

export const handleDashboardTrend = async (days = 7) => {
  return await commentStore.getDashboardTrend(days)
}
// ========== Reaction (merged from handlers/reaction.ts) ==========

export const handleReactionGet = async (data: ReactionGetData & { _ip?: string }) => {
  const url = data.url || '/'
  const ip = data._ip || 'unknown'
  const raw = await reactionStore.getReactions(url)
  return formatReactions(raw, ip)
}

export const handleReactionSubmit = async (data: ReactionSubmitData & { _ip?: string }) => {
  const { emoji } = data
  const url = data.url || '/'
  const ip = data._ip || 'unknown'

  const raw = await reactionStore.toggleReaction(url, emoji, ip)
  return formatReactions(raw, ip)
}

function formatReactions (raw: Record<string, string[]>, ip: string) {
  const reactions: Record<string, number> = {}
  const myReactions: string[] = []

  for (const [emoji, ips] of Object.entries(raw)) {
    if (ips.length > 0) {
      reactions[emoji] = ips.length
      if (ips.includes(ip)) myReactions.push(emoji)
    }
  }
  return { reactions, myReactions }
}

// ========== Counter (merged from handlers/counter.ts) ==========

export const handleCounterGet = async (data: any) => {
  const validation = safeValidate(CounterGetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data as { url: string; title?: string }
  return visitorStore.getVisitorCount(url || '/', title)
}

export const handleCounterUpdate = async (data: any) => {
  const validation = safeValidate(CounterUpdateSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data as { url: string; title?: string }
  return visitorStore.getVisitorCount(url ?? '/', title)
}

export const handleGetCommentsCount = async (data: any) => {
  const validation = safeValidate(CommentsCountSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { data: await commentStore.getCommentsCount((validation.data as { urls: string[] }).urls) }
}

export const handleGetRecentComments = async (data: any) => {
  const validation = safeValidate(RecentCommentsSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const result = await commentStore.getRecentComments((validation.data as { count: number }).count)

  const rawCfg = await getConfig()
  markMasterComments(result, rawCfg)

  return { data: result }
}
