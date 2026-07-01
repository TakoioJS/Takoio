/**
 * Store 共享工具函数 — 被 sqlite.ts / postgres.ts / mongodb.ts 复用
 */

import type { Comment, CommentInput } from './types'

/** 评论状态常量 */
export const COMMENT_STATE = {
  VISIBLE: 'visible',
  HIDDEN: 'hidden',
  SPAM: 'spam',
  PENDING: 'pending',
} as const

/** 相对时间格式化 */
export function relTime (ts: number, locale?: string): string {
  const diff = Date.now() - ts
  const isZh = !locale || locale.startsWith('zh')
  if (diff < 60000) return isZh ? '刚刚' : 'just now'
  if (diff < 3600000) return isZh ? `${Math.floor(diff / 60000)} 分钟前` : `${Math.floor(diff / 60000)} min ago`
  if (diff < 86400000) return isZh ? `${Math.floor(diff / 3600000)} 小时前` : `${Math.floor(diff / 3600000)} hr ago`
  if (diff < 604800000) return isZh ? `${Math.floor(diff / 86400000)} 天前` : `${Math.floor(diff / 86400000)} days ago`
  return new Date(ts).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')
}

/** 移除隐私字段（ip/mail）并附加 relativeTime */
export function stripPrivate (r: Comment | null): Omit<Comment, 'ip' | 'mail'> & { relativeTime: string } | null {
  if (!r) return r
  const { ip: _ip, mail: _mail, ...rest } = r
  return { ...rest, relativeTime: relTime(rest.created) }
}

/** 数据库行 → 归一化 Comment（布尔字段转换） */
export function fromRow (r: any): Comment {
  if (!r) return r
  return {
    ...r,
    like: r.like ?? 0,
    dislike: r.dislike ?? 0,
    isSpam: !!r.isSpam,
    isTop: !!r.isTop,
    isPinned: !!r.isPinned,
  }
}

/** PG 行 → 归一化 Comment（PG 原生 boolean，仅补默认值） */
export function fromRowPg (r: any): Comment {
  if (!r) return r
  return {
    ...r,
    like: r.like ?? 0,
    dislike: r.dislike ?? 0,
    isSpam: r.isSpam ?? false,
    isTop: r.isTop ?? false,
    isPinned: r.isPinned ?? false,
  }
}

/** CommentInput → SQLite 行（布尔转整数） */
export function commentToSqliteRow (data: CommentInput) {
  return {
    ...data,
    like: data.like ?? 0,
    dislike: data.dislike ?? 0,
    isSpam: data.isSpam ? 1 : 0,
    isTop: data.isTop ? 1 : 0,
    isPinned: data.isPinned ? 1 : 0,
  }
}

/** CommentInput → PG 行（原生 boolean） */
export function commentToPgRow (data: CommentInput) {
  return {
    ...data,
    like: data.like ?? 0,
    dislike: data.dislike ?? 0,
  }
}

/** MongoDB 文档 → 归一化 Comment（_id → id） */
export function normalizeDoc (r: any): Comment | null {
  if (!r) return r
  const { _id, ...rest } = r
  return { id: _id, ...rest, like: r.like ?? 0, dislike: r.dislike ?? 0 } as Comment
}

/** MongoDB CommentInput → 文档 */
export function commentToDoc (data: CommentInput) {
  return {
    _id: data.id,
    url: data.url,
    href: data.href,
    nick: data.nick,
    mail: data.mail,
    mailMd5: data.mailMd5,
    link: data.link,
    comment: data.comment,
    ua: data.ua,
    ip: data.ip,
    state: data.state,
    created: data.created,
    updated: data.updated,
    pid: data.pid,
    rid: data.rid,
    like: data.like ?? 0,
    dislike: data.dislike ?? 0,
    isSpam: data.isSpam,
    isTop: data.isTop,
    isPinned: data.isPinned,
    image: data.image,
    sticker: data.sticker,
    ipRegion: data.ipRegion,
    tags: data.tags,
    renderedComment: data.renderedComment,
  }
}

/** 批量插入分批大小 */
export const BATCH_SIZE_SQLITE = 50
export const BATCH_SIZE_PG = 100
export const BATCH_SIZE_MONGO = 100
