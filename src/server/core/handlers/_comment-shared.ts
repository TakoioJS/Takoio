/**
 * Comment handlers 共享工具 — 被 comment-*.ts 模块复用
 */

import * as crypto from 'node:crypto'
import { commentStore } from '../store/index'
import { invalidateCommentListCache } from '../store/redis'

/** 可标记博主的结构 — Comment 与 CommentListItem 均满足 */
export interface MarkableComment {
  nick: string
  mailMd5?: string
  isMaster?: boolean
  children?: MarkableComment[]
}

/** Mark comments whose nick or email matches the site master */
export function markMasterComments (comments: MarkableComment[], cfg: { MASTER?: string; MASTER_NAME?: string }) {
  const masterMailMd5 = cfg.MASTER ? crypto.createHash('md5').update(cfg.MASTER.trim().toLowerCase()).digest('hex') : ''
  const masterName = cfg.MASTER_NAME || ''
  const mark = (c: MarkableComment) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
    if (c.children) c.children.forEach(mark)
  }
  comments.forEach(mark)
}

/** HTML 转义辅助 */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 获取评论 url 并失效其列表缓存（管理操作后调用） */
export async function invalidateCommentCacheById (id: string): Promise<void> {
  try {
    const comment = await commentStore.getComment(id)
    if (comment?.url) await invalidateCommentListCache(comment.url)
  } catch (e) {
    // ignore — cache 失效失败不影响主流程
  }
}
