/**
 * Comment Misc — 计数器、统计、最近评论、页面反应
 */

import { safeValidate } from '../schemas'
import {
  CounterGetSchema,
  CounterUpdateSchema,
  CommentsCountSchema,
  RecentCommentsSchema,
  ReactionGetSchema,
  ReactionSubmitSchema,
} from '../schemas'
import type {
  CounterGetData,
  CounterUpdateData,
  ReactionGetData,
  ReactionSubmitData,
} from '../schemas'
import { commentStore, visitorStore, reactionStore } from '../store/index'
import { getConfig } from '../config'
import { markMasterComments, normalizeCommentHref } from './_comment-shared'
import { AppError } from '../config'

// ========== Counter ==========

export const handleCounterGet = async (data: CounterGetData) => {
  const validation = safeValidate(CounterGetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data
  return visitorStore.getVisitorCount(url || '/', title)
}

export const handleCounterUpdate = async (data: CounterUpdateData) => {
  const validation = safeValidate(CounterUpdateSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data
  return visitorStore.getVisitorCount(url ?? '/', title)
}

// ========== Comments Count ==========

export const handleGetCommentsCount = async (data: { urls: string[] }) => {
  const validation = safeValidate(CommentsCountSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { data: await commentStore.getCommentsCount(validation.data.urls) }
}

// ========== Recent Comments ==========

export const handleGetRecentComments = async (data: { count: number }) => {
  const validation = safeValidate(RecentCommentsSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const result = await commentStore.getRecentComments(validation.data.count)

  const rawCfg = await getConfig()
  markMasterComments(result, rawCfg)
  for (const c of result) {
    c.href = normalizeCommentHref(c, rawCfg.SITE_URL || '')
  }

  return { data: result }
}

// ========== Dashboard Stats ==========

export const handleDashboardStats = async () => {
  return await commentStore.getDashboardStats()
}

export const handleDashboardTrend = async (days = 7) => {
  return await commentStore.getDashboardTrend(days)
}

// ========== Page Reactions ==========

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
