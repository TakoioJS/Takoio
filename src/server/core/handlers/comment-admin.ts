/**
 * Comment Admin — 管理操作（更新、删除、隐藏、置顶、审核、批量）
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import {
  CommentIdSchema,
  CommentActionSchema,
  CommentSetTopSchema,
  CommentSetSpamSchema,
  UpdateCommentSchema,
  AdminCommentSchema,
} from '../schemas'
import type {
  CommentIdData,
  CommentActionData,
  CommentSetTopData,
  CommentSetSpamData,
  UpdateCommentData,
  AdminCommentData,
} from '../schemas'
import { commentStore } from '../store/index'
import { getConfig } from '../config'
import { renderComment } from '../utils/render'
import { markMasterComments, invalidateCommentCacheById, normalizeCommentHref } from './_comment-shared'
import { AppError } from '../errors'

// ========== Comment Update ==========

export const handleCommentUpdate = async (data: UpdateCommentData) => {
  const validation = safeValidate(UpdateCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { id, nick, mail, link, comment } = validation.data
  const mailMd5 = mail ? crypto.createHash('sha256').update(mail.trim().toLowerCase()).digest('hex') : ''
  const renderedComment = comment ? await renderComment(comment).catch(() => null) : undefined
  await commentStore.updateComment(id, { nick, mail, mailMd5, link, comment, ...(renderedComment ? { renderedComment } : {}) })
  await invalidateCommentCacheById(id)
  return { success: true }
}

// ========== Comment Delete ==========

export const handleCommentDelete = async (data: CommentIdData, _event?: any) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  await invalidateCommentCacheById(validation.data.id)
  return { success: await commentStore.deleteComment(validation.data.id) }
}

// ========== Comment Hide ==========

export const handleCommentHide = async (data: CommentActionData) => {
  const validation = safeValidate(CommentActionSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const id = validation.data.id
  await invalidateCommentCacheById(id)
  if (validation.data.hide) return { success: await commentStore.hideComment(id) }
  return { success: await commentStore.showComment(id) }
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
  for (const c of result.data) {
    c.href = normalizeCommentHref(c, rawCfg.SITE_URL || '')
  }

  return result
}

// ========== Comment Set Top ==========

export const handleCommentSetTop = async (data: CommentSetTopData) => {
  const validation = safeValidate(CommentSetTopSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const isTop = validation.data.isTop ?? true
  await invalidateCommentCacheById(validation.data.id)
  return { success: await commentStore.setTop(validation.data.id, isTop) }
}

// ========== Comment Set Spam ==========

export const handleCommentSetSpam = async (data: CommentSetSpamData) => {
  const validation = safeValidate(CommentSetSpamSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const isSpam = validation.data.isSpam ?? true
  await invalidateCommentCacheById(validation.data.id)
  return { success: await commentStore.setSpam(validation.data.id, isSpam) }
}

// ========== Comment Approve (pending → visible) ==========

export const handleCommentApprove = async (data: CommentIdData, _event?: any) => {
  const validation = safeValidate(CommentIdSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  await invalidateCommentCacheById(validation.data.id)
  return { success: await commentStore.showComment(validation.data.id) }
}

// ========== Comment Batch ==========

type BatchAction = 'hide' | 'show' | 'delete' | 'spam' | 'approve' | 'unspam'

interface BatchData {
  ids: string[]
  action: BatchAction
}

const VALID_BATCH_ACTIONS: BatchAction[] = ['hide', 'show', 'delete', 'spam', 'approve', 'unspam']

export const handleCommentBatch = async (data: BatchData) => {
  if (!Array.isArray(data.ids) || data.ids.length === 0) {
    throw new AppError('INVALID_INPUT', 'ids 不能为空', 400)
  }
  if (data.ids.length > 500) {
    throw new AppError('INVALID_INPUT', '单次批量操作不能超过 500 条', 400)
  }
  if (!VALID_BATCH_ACTIONS.includes(data.action)) {
    throw new AppError('INVALID_INPUT', `不支持的 action: ${data.action}`, 400)
  }

  const failedIds: string[] = []
  const errors: Record<string, string> = {}
  const urlSet = new Set<string>()

  // 逐条执行（各 store 实现内部用单条 UPDATE），收集 url 用于批量失效缓存
  for (const id of data.ids) {
    try {
      const comment = await commentStore.getComment(id)
      if (comment?.url) urlSet.add(comment.url)
      let ok = false
      switch (data.action) {
        case 'hide': ok = await commentStore.hideComment(id); break
        case 'show': ok = await commentStore.showComment(id); break
        case 'delete': ok = await commentStore.deleteComment(id); break
        case 'spam': ok = await commentStore.setSpam(id, true); break
        case 'unspam': ok = await commentStore.setSpam(id, false); break
        case 'approve': ok = await commentStore.showComment(id); break
      }
      if (!ok) {
        failedIds.push(id)
        errors[id] = '操作失败'
      }
    } catch (e: any) {
      failedIds.push(id)
      errors[id] = e.message || '操作异常'
    }
  }

  // 批量失效缓存（一次 per url，不再每个 id 一次）
  await Promise.all(
    Array.from(urlSet).map(url =>
      import('../store/redis').then(({ invalidateCommentListCache }) =>
        invalidateCommentListCache(url).catch(e => {
          import('../utils/logger').then(({ logger }) => logger.warn('[comment-batch] Cache invalidation failed:', e))
        })
      )
    )
  )

  return {
    success: failedIds.length === 0,
    total: data.ids.length,
    failed: failedIds.length,
    failedIds,
    errors,
  }
}
