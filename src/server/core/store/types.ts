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

// ========== User ==========

export type UserRole = 'user' | 'banned'
export type AuthProvider = 'github' | 'google' | 'email'

/** 用户 — OAuth / 邮箱登录时自动创建 */
export interface User {
  id: string
  provider: AuthProvider
  providerId: string
  email: string
  name: string
  avatar?: string | null
  role: UserRole
  createdAt: number
  lastLoginAt: number
  loginCount: number
}

/** 更新用户的可选字段 */
export interface UserUpdate {
  name?: string
  avatar?: string | null
  role?: UserRole
  lastLoginAt?: number
  loginCount?: number
}

// ========== Comment (现有，追加 userId / authProvider) ==========

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
  isPrivate: boolean
  /** 登录用户所关联的 User.id（匿名评论为 null） */
  userId?: string | null
  /** 冗余字段：登录时的 provider（github/google/email），用于显示标识 */
  authProvider?: string | null
  image?: string | null
  sticker?: string | null
  ipRegion?: string | null
  tags?: string | null
  renderedComment?: string | null
}

/**
 * 客户端提交评论时允许传入的字段。
 * 仅包含用户可控制的输入；服务器生成/计算字段（id、created、state、like 等） excluded。
 */
export interface CreateCommentPayload {
  url: string
  href?: string | null
  nick: string
  mail?: string
  link?: string
  comment: string
  ua?: string
  pid?: string | null
  rid?: string | null
  image?: string | null
  sticker?: string | null
  isPrivate?: boolean
}

/**
 * 新增评论时的输入 — 由 handler 层构造后传给 store。
 * 注意：id / created / state / like / dislike / isSpam / isTop / isPinned
 * 必须由 handler 层设置，客户端不得直接传入。
 * 计算字段（mailMd5 / ipRegion / renderedComment / tags）由 handler 或 store 填充，可为可选。
 */
export interface CommentInput extends CreateCommentPayload {
  id: string
  ip: string
  state: CommentState
  created: number
  updated?: number | null
  like: number
  dislike: number
  isSpam: boolean
  isTop: boolean
  isPinned: boolean
  isPrivate: boolean
  userId?: string | null
  authProvider?: string | null
  mailMd5?: string
  ipRegion?: string | null
  tags?: string | null
  renderedComment?: string | null
}

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
  isPrivate?: boolean
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

// ========== Store interfaces ==========
// 注意：所有后端实现（sqlite.ts / mongodb.ts / postgres.ts）
// 必须返回符合这些 interface 的数据，由 TS 编译器强制校验签名一致性。

export interface CommentStore {
  addComment (data: CommentInput): Promise<Comment>
  /** 批量插入评论（导入用），返回插入条数 */
  addComments (data: CommentInput[]): Promise<number>
  getComment (id: string): Promise<Comment | undefined>
  updateComment (id: string, data: CommentUpdate): Promise<boolean>
  getComments (url: string, page?: number, pageSize?: number, sort?: CommentSort): Promise<PaginatedResult<CommentListItem>>
  getReplies (pid: string): Promise<CommentListItem[]>
  getCommentsCount (urls: string[]): Promise<CommentCount[]>
  getRecentComments (limit?: number): Promise<CommentListItem[]>
  getRawRecentComments (limit?: number): Promise<RawComment[]>
  getCommentReactions (commentId: string): Promise<CommentReactionMap>
  toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<CommentReactionMap>
  setCommentState (id: string, state: CommentState): Promise<boolean>
  hideComment (id: string): Promise<boolean>
  showComment (id: string): Promise<boolean>
  deleteComment (id: string): Promise<boolean>
  setTop (id: string, isTop: boolean): Promise<boolean>
  setSpam (id: string, isSpam?: boolean): Promise<boolean>
  getDashboardStats (): Promise<DashboardStats>
  getDashboardTrend (days?: number): Promise<DashboardTrendItem[]>
  setCommentIpRegion (id: string, ipRegion: string): Promise<boolean>
  getAllComments (page?: number, pageSize?: number): Promise<PaginatedResult<Comment>>
  searchComments (page?: number, pageSize?: number, searchStr?: string, filter?: string): Promise<PaginatedResult<Comment>>
}

export interface ConfigStore {
  getConfig (): Promise<Record<string, unknown>>
  setConfig (key: string, value: unknown): Promise<void>
  setManyConfig (data: Record<string, unknown>): Promise<void>
  resetConfig (): Promise<void>
}

export interface VisitorStore {
  getVisitorCount (url: string, title?: string): Promise<VisitorCount>
}

export interface SessionStore {
  createToken (): Promise<string>
  validateToken (token: string): Promise<boolean>
  removeToken (token: string): Promise<void>
  rotateToken (oldToken: string): Promise<string | null>
  removeAllTokens (): Promise<void>
  cleanupSessions (): Promise<void>
}

export interface ReactionStore {
  getReactions (url: string): Promise<ReactionMap>
  toggleReaction (url: string, emoji: string, ip: string): Promise<ReactionMap>
}

export interface UserStore {
  /** OAuth 回调 / 邮箱验证时 upsert，按 provider+providerId 匹配 */
  upsertUser (data: {
    provider: AuthProvider
    providerId: string
    email: string
    name: string
    avatar?: string | null
  }): Promise<User>
  /** 管理面板：用户列表 */
  getUsers (page?: number, pageSize?: number, search?: string, filter?: string): Promise<PaginatedResult<User>>
  /** 单用户查询 */
  getUser (id: string): Promise<User | undefined>
  getUserByEmail (email: string): Promise<User | undefined>
  /** 封禁 / 解封 */
  setUserRole (id: string, role: UserRole): Promise<boolean>
  /** 统计总数（概览用） */
  getUserCount (): Promise<number>
}

/**
 * Store backend module shape — every backend (sqlite/mongodb/postgres)
 * must export these members. Enforces compile-time consistency across implementations.
 */
export interface StoreBackend {
  commentStore: CommentStore
  configStore: ConfigStore
  visitorStore: VisitorStore
  sessionStore: SessionStore
  reactionStore: ReactionStore
  userStore: UserStore
  getStore (): Promise<StoreSnapshot>
  importStore (data: StoreImportData): Promise<void>
  ensureDb (): Promise<void>
}
