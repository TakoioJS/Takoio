/**
 * Comment Reaction — 评论点赞/反应
 */

import { commentStore } from '../store/index'
import type { CommentReactionGetData, CommentReactionSubmitData } from '../schemas'

export const handleCommentReactionGet = async (data: CommentReactionGetData & { _ip?: string }) => {
  const { id } = data
  const ip = data._ip || 'unknown'
  const raw = await commentStore.getCommentReactions(id)
  return formatCommentReactions(raw, ip)
}

export const handleCommentReactionSubmit = async (data: CommentReactionSubmitData & { _ip?: string }) => {
  const { id, emoji } = data
  if (!id) throw new (await import('../config').then(m => m.AppError))('INVALID_INPUT', '缺少评论 id', 400)
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
