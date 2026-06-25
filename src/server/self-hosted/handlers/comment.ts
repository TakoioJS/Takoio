/**
 * Comment handlers — get, submit, update, like/dislike, delete, hide, admin, setTop, setSpam
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import {
  GetCommentSchema,
  SubmitCommentSchema,
  CommentIdSchema,
  CommentActionSchema,
  UpdateCommentSchema,
  AdminCommentSchema,
} from '../schemas'
import type {
  GetCommentData,
  SubmitCommentData,
  CommentIdData,
  CommentActionData,
  UpdateCommentData,
  AdminCommentData,
} from '../schemas'
import { commentStore } from '../store/index'
import { getConfig, maskSensitiveConfig } from '../config'
import { verifyCaptcha } from '../auth'
import { moderateComment, getAuditAction } from '../moderate'
import { sendNotification } from '../notify'
import { lookupIpRegion } from '../ip-region'
import { requireAdmin } from '../auth'
import { logger } from '../utils/logger'
import { AppError } from '../utils/errors'
import { renderComment } from '../utils/render'

// ========== Comment Get ==========

export const handleCommentGet = async (data: GetCommentData) => {
  const validation = safeValidate(GetCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, page, pageSize, sort } = validation.data
  const result = await commentStore.getComments(url || '/', page, pageSize, sort)
  const rawCfg = await getConfig()
  
  const masterMailMd5 = rawCfg.MASTER ? crypto.createHash('md5').update(rawCfg.MASTER.trim().toLowerCase()).digest('hex') : ''
  const masterName = rawCfg.MASTER_NAME || ''
  const checkMaster = (c: any) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
    if (c.children) c.children.forEach(checkMaster)
  }
  result.data.forEach(checkMaster)

  const cfg = maskSensitiveConfig(rawCfg)
  return { ...result, config: cfg }
}

// ========== Comment Submit ==========

export const handleCommentSubmit = async (data: SubmitCommentData & { _ip?: string }): Promise<any> => {
  // Server-injected fields (not in client schema)
  const _ip = data._ip

  // Validate
  const validation = safeValidate(SubmitCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  const { url, nick, mail, link, comment, pid, rid, ua, sticker, image, title, captchaToken } = validation.data

  const cfg = await getConfig()

  // Impersonation protection: require admin login if nick/email matches master
  if ((cfg.MASTER_NAME && nick === cfg.MASTER_NAME) || (cfg.MASTER && mail === cfg.MASTER)) {
    await requireAdmin(data)
  }

  // CAPTCHA — server-side enforcement: if enabled, token is mandatory
  if (cfg.ENABLE_CAPTCHA) {
    if (!captchaToken) {
      throw new AppError('INVALID_CAPTCHA', '请完成人机验证', 400)
    }
    await verifyCaptcha(captchaToken, cfg)
  }

  const mailMd5 = mail ? crypto.createHash('md5').update(mail.trim().toLowerCase()).digest('hex') : ''

  const newComment = {
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
    updated: null as number | null,
    pid: pid || null,
    rid: rid || null,
    like: 0,
    dislike: 0,
    isSpam: false,
    isTop: false,
    image: image || null,
    sticker: sticker || null,
    ipRegion: null as string | null,
    renderedComment: null as string | null,
  }

  // AI moderation
  let aiEndpoint = ''
  let aiKey = ''
  let aiFormat = ''

  if (cfg.AUTO_AUDIT_METHOD === 'ai') {
    try {
      const providers = JSON.parse(cfg.AI_PROVIDERS || '[]')
      const provider = providers.find((p: any) => p.id === cfg.AUTO_AUDIT_AI_PROVIDER)
      if (provider) {
        aiEndpoint = provider.endpoint || ''
        aiKey = provider.key || ''
        aiFormat = provider.format || ''
      }
    } catch (e) {
      // JSON parse error, ignore
    }
  }

  const modResult = await moderateComment(
    newComment.comment, newComment.nick, newComment.link,
    {
      enabled: cfg.AUTO_AUDIT_METHOD === 'ai',
      endpoint: aiEndpoint,
      key: aiKey,
      model: cfg.AUTO_AUDIT_AI_MODEL,
      prompt: cfg.AUTO_AUDIT_AI_PROMPT,
      format: aiFormat,
      blockedKeywords: cfg.BLOCKED_KEYWORDS,
    }
  )

  const rawRecent = await commentStore.getRawRecentComments(50)

  // 1. 评论频次限制
  const limit = typeof cfg.COMMENT_RATE_LIMIT === 'number' ? cfg.COMMENT_RATE_LIMIT : 30000
  if (limit > 0 && _ip && _ip !== 'unknown') {
    const myRecent = rawRecent.filter(c => c.ip === _ip || (mail && c.mail === mail))
    if (myRecent.length > 0) {
      if (Date.now() - myRecent[0].created < limit) {
        throw new AppError('RATE_LIMIT_EXCEEDED', '评论太频繁，请稍后再试', 429)
      }
    }
  }

  // 2. 防灌水（相似度检测）
  function getBigrams(str: string) {
    const s = new Set<string>()
    for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2))
    return s
  }
  const setA = getBigrams(newComment.comment)
  if (setA.size > 0) {
    let maxSim = 0
    for (const c of rawRecent.slice(0, 20)) {
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
    logger.info({ source: modResult.source, score: modResult.score, reasons: modResult.reasons }, 'Comment rejected')
    throw new AppError('MODERATION_FAILED', '评论审核未通过，请修改后再试', 400)
  }
  if (auditAction === 'pending') {
    newComment.state = 'pending'
    logger.info({ source: modResult.source, score: modResult.score, reasons: modResult.reasons }, 'Comment pending review')
  }

  // IP region
  if (_ip && _ip !== 'unknown') {
    try {
      newComment.ipRegion = await lookupIpRegion(_ip)
    } catch { newComment.ipRegion = '' }
  }

  try { newComment.renderedComment = await renderComment(newComment.comment) } catch {}

  const saved = await commentStore.addComment(newComment)

  // Notification
  const siteName = cfg.SITE_NAME || 'Takoio'
  sendNotification(cfg, {
    title: `${nick} 评论了「${title || siteName}」`,
    content: `${nick} 在 ${title || siteName} 发表了评论：\n\n> ${comment.slice(0, 200)}${comment.length > 200 ? '...' : ''}`,
    siteName,
  }).catch(e => logger.error({ error: e.message }, 'Notification failed'))

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

// In-memory dedup: track like/dislike by comment+ip
const reactionIps = new Map<string, Set<string>>()
const REACTION_TTL = 24 * 60 * 60 * 1000 // 24 hours
setInterval(() => reactionIps.clear(), REACTION_TTL).unref()

const hasReacted = (commentId: string, ip: string): boolean => {
  const set = reactionIps.get(commentId)
  return set ? set.has(ip) : false
}

const markReacted = (commentId: string, ip: string): void => {
  let set = reactionIps.get(commentId)
  if (!set) { set = new Set(); reactionIps.set(commentId, set) }
  set.add(ip)
}

// ========== Comment Like ==========

export const handleCommentLike = async (data: CommentIdData & { _ip?: string }) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { id } = validation.data
  const ip = data._ip || ''
  if (ip && hasReacted(id, ip)) return { success: false, message: 'already_reacted' }
  const result = await commentStore.likeComment(id)
  if (result && ip) markReacted(id, ip)
  return { success: result }
}

// ========== Comment Dislike ==========

export const handleCommentDislike = async (data: CommentIdData & { _ip?: string }) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { id } = validation.data
  const ip = data._ip || ''
  if (ip && hasReacted(id, ip)) return { success: false, message: 'already_reacted' }
  const result = await commentStore.dislikeComment(id)
  if (result && ip) markReacted(id, ip)
  return { success: result }
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
  let result;
  if (search || (filter && filter !== 'all')) {
    result = await commentStore.searchComments(page, pageSize, search, filter)
  } else {
    result = await commentStore.getAllComments(page, pageSize)
  }

  const rawCfg = await getConfig()
  const masterMailMd5 = rawCfg.MASTER ? crypto.createHash('md5').update(rawCfg.MASTER.trim().toLowerCase()).digest('hex') : ''
  const masterName = rawCfg.MASTER_NAME || ''
  
  const checkMaster = (c: any) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
  }
  result.data.forEach(checkMaster)

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

export const handleCommentSetSpam = async (data: CommentIdData) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { success: await commentStore.setSpam(validation.data.id) }
}
