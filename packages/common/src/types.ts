/**
 * @takoio/common — Shared types and utilities
 * Used by: @takoio client, takoio server, takoio admin
 */

// ========== Comment Types ==========

/** 评论对象 */
export interface Comment {
  id: string
  url: string
  href?: string
  nick: string
  mail?: string
  mailMd5?: string
  link?: string
  comment: string
  ua: string
  ip?: string
  state?: string
  created: number
  updated?: number
  pid?: string
  rid?: string
  isSpam?: boolean
  isTop?: boolean
  isPinned?: boolean
  isCollapsed?: boolean
  relativeTime?: string
  children?: Comment[]
  avatar?: string
  replyCount?: number
  isAdmin?: boolean
  isMaster?: boolean
  image?: string
  tags?: string[]
  ipRegion?: string
  replyToNick?: string
  renderedComment?: string
  _safeContent?: string
}

/** 评论提交参数 */
export interface CommentSubmit {
  url: string
  href?: string
  nick: string
  mail?: string
  link?: string
  comment: string
  pid?: string
  rid?: string
  ua?: string
  ip?: string
  image?: string
  sticker?: string
  at?: string
  isAdmin?: boolean
  password?: string
  token?: string
}

// ========== API Types ==========

/** API 响应 */
export interface ApiResponse<T = any> {
  result: T
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  total: number
  data: T[]
}

/** 评论计数响应 */
export interface CommentCount {
  url: string
  count: number
}

/** 最近评论 */
export type RecentComments = Comment[]

/** 访客计数 */
export interface VisitorsCount {
  time: number
  url: string
  title?: string
}

// ========== Utility Types ==========

export type TexRenderer = (blockMode: boolean, tex: string) => string | Promise<string>

export type Lang = 'zh-CN' | 'zh-TW' | 'en' | string
