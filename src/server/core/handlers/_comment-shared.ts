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
  // Use SHA-256 instead of MD5 for Gravatar hash to mitigate rainbow-table risks.
  // 注意：config 存储层把字符串原样写入，读取时统一 JSON.parse，因此 `"12345"` 这种
  // 全数字字符串会被解析回 number 类型。直接对 number 调用 .trim() 会抛 TypeError，
  // 导致所有评论列表加载失败。这里强制 String() 转换以避免类型崩溃。
  const masterMailMd5 = cfg.MASTER ? crypto.createHash('sha256').update(String(cfg.MASTER).trim().toLowerCase()).digest('hex') : ''
  const masterName = String(cfg.MASTER_NAME || '')
  const mark = (c: MarkableComment) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
    if (c.children) c.children.forEach(mark)
  }
  comments.forEach(mark)
}

/** 获取评论 url 并失效其列表缓存（管理操作后调用） */
export async function invalidateCommentCacheById (id: string): Promise<void> {
  try {
    const comment = await commentStore.getComment(id)
    if (comment?.url) await invalidateCommentListCache(comment.url)
  } catch (e) {
    // ignore — cache 失效失败不影响主流程
  }
}

/** Normalize comment href to an absolute URL for admin/dashboard display.
 *  Falls back to SITE_URL + url when href is missing or relative.
 */
export function normalizeCommentHref (comment: { href?: string | null; url?: string }, siteUrl: string): string {
  const raw = (comment.href || comment.url || '').trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const path = raw.replace(/^\/+/, '')
  const base = (siteUrl || '').replace(/\/+$/, '')
  if (!base) return path ? `/${path}` : '#'
  return `${base}/${path}`
}
