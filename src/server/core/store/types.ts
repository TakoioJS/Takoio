/**
 * Store 层共享类型定义
 *
 * 设计原则：
 * - 这些类型描述的是「store 层对外暴露的归一化后的数据形态」，
 *   而非「数据库原始行」。SQLite 的 0/1 整数、MongoDB 的 _id
 *   在 store 实现内部已完成转换（fromRow / normalizeDoc）。
 * - 所有后端实现（sqlite / mongodb / 未来的 postgres）都必须
 *   返回符合这些类型的数据，由 index.ts 的 interface 强制约束。
 */

// ========== Comment ==========

/** 评论 state 字段的合法值 */
export type CommentState = 'visible' | 'hidden' | 'spam' | 'pending'

/** 评论排序方式 */
export type CommentSort = 'newest' | 'oldest' | 'hottest'

/**
 * 评论对象 — store 层归一化后的形态
 * 布尔字段已经是 boolean（SQLite 端由 fromRow 转换，MongoDB 端原生）
 */
export interface Comment {
  id: string
  url: string
  href?: string | null
  nick: string
  mail?: string
  mailMd5?: string
  link?: string
  comment: string
  ua?: string
  ip?: string
  state: CommentState
  created: number
  updated?: number | null
  pid?: string | null
  rid?: string | null
  like: number
  dislike: number
  isSpam: boolean
  isTop: boolean
  isPinned: boolean
  image?: string | null
  sticker?: string | null
  ipRegion?: string | null
  tags?: string | null
  renderedComment?: string | null
}

/**
 * 新增评论时的输入 — 由 handler 层构造
 * id / created 由 handler 生成，store 层直接透传
 */
export type CommentInput = Comment

/**
 * 评论列表项 — 在 Comment 基础上附加 UI 层需要的字段
 * stripPrivate 已移除 ip / mail，并附加 relativeTime
 */
export interface CommentListItem extends Omit<Comment, 'ip' | 'mail'> {
  relativeTime: string
  /** 子回复列表（stripPrivate 后的形态，不含 ip/mail） */
  children: CommentListItem[]
  replyCount: number
  /** 博主标记（由 handler 层 markMasterComments 写入） */
  isMaster?: boolean
}

/** 更新评论的可选字段 */
export interface CommentUpdate {
  nick?: string
  mail?: string
  mailMd5?: string
  link?: string
  comment?: string
  renderedComment?: string | null
  state?: CommentState
  isSpam?: boolean
  isTop?: boolean
  isPinned?: boolean
  ipRegion?: string
  tags?: string
}

/** 带有原始 ip/mail 的评论（仅限 admin / 内部使用，如限流、相似度检测） */
export interface RawComment extends Comment {
  ip: string
  mail: string
}

// ========== Dashboard ==========

export interface DashboardStats {
  total: number
  today: number
  yesterday: number
  pending: number
  spam: number
  hidden: number
  topCount: number
}

export interface DashboardTrendItem {
  date: string
  count: number
}

// ========== Config ==========

/** 配置项原始存储形态（key → {value, updatedAt}） */
export interface ConfigRow {
  value: string
  updatedAt: number
}

// ========== Visitor ==========

export interface VisitorCount {
  url: string
  time: number
  updatedAt: number
}

// ========== Reaction ==========

/** 文章级 reaction: emoji → ip 列表 */
export type ReactionMap = Record<string, string[]>

/** 评论级 reaction: emoji → {count, ips} */
export type CommentReactionMap = Record<string, { count: number; ips: string[] }>

// ========== Comment count ==========

export interface CommentCount {
  url: string
  count: number
}

// ========== Pagination ==========

export interface PaginatedResult<T> {
  data: T[]
  total: number
}

// ========== Store export/import ==========

/** getStore() 返回的完整数据快照 */
export interface StoreSnapshot {
  comments: Comment[]
  configs: Record<string, ConfigRow>
  visitors: Record<string, { title: string; count: number; updatedAt: number }>
  sessions: Array<{ token: string; createdAt: number }>
  reactions: Record<string, ReactionMap>
  commentReactions: Record<string, ReactionMap>
}

/** importStore() 接受的数据形态（与 StoreSnapshot 兼容，但字段可选） */
export interface StoreImportData {
  comments?: Comment[]
  configs?: Record<string, ConfigRow>
  visitors?: Record<string, { title: string; count: number; updatedAt: number }>
  sessions?: Array<{ token: string; createdAt: number }>
  reactions?: Record<string, ReactionMap>
  commentReactions?: Record<string, ReactionMap>
}
