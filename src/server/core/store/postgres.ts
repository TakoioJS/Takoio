import { getDb, initDb } from '../db/pg-client'
import { comments, configs, visitors, sessions, reactions, commentReactions } from '../db/schema-pg'
import { eq, and, inArray, like, or, sql, asc, desc, count as drizzleCount } from 'drizzle-orm'
import type {
  Comment,
  CommentInput,
  CommentListItem,
  CommentUpdate,
  RawComment,
  CommentCount,
  DashboardStats,
  DashboardTrendItem,
  VisitorCount,
  ReactionMap,
  CommentReactionMap,
  PaginatedResult,
  StoreSnapshot,
  StoreImportData,
  CommentState,
  CommentSort,
} from './types'
import type {
  CommentStore,
  ConfigStore,
  VisitorStore,
  SessionStore,
  ReactionStore,
} from './index'

export const COMMENT_STATE = {
  VISIBLE: 'visible', HIDDEN: 'hidden', SPAM: 'spam', PENDING: 'pending',
} as const

const relTime = (ts: number, locale?: string): string => {
  const diff = Date.now() - ts
  const isZh = !locale || locale.startsWith('zh')
  if (diff < 60000) return isZh ? '刚刚' : 'just now'
  if (diff < 3600000) return isZh ? `${Math.floor(diff / 60000)} 分钟前` : `${Math.floor(diff / 60000)} min ago`
  if (diff < 86400000) return isZh ? `${Math.floor(diff / 3600000)} 小时前` : `${Math.floor(diff / 3600000)} hr ago`
  if (diff < 604800000) return isZh ? `${Math.floor(diff / 86400000)} 天前` : `${Math.floor(diff / 86400000)} days ago`
  return new Date(ts).toLocaleDateString(isZh ? 'zh-CN' : 'en-US')
}

/** 移除隐私字段（ip/mail）并附加 relativeTime */
const stripPrivate = (r: Comment | null): Omit<Comment, 'ip' | 'mail'> & { relativeTime: string } | null => {
  if (!r) return r
  const { ip: _ip, mail: _mail, ...rest } = r
  return { ...rest, relativeTime: relTime(rest.created) }
}

/** PG 行已是原生 boolean，无需转换；仅补默认值 */
const fromRow = (r: any): Comment => r
  ? {
      ...r,
      like: r.like ?? 0,
      dislike: r.dislike ?? 0,
      isSpam: r.isSpam ?? false,
      isTop: r.isTop ?? false,
      isPinned: r.isPinned ?? false,
    }
  : r

const db = () => getDb()

export const commentStore: CommentStore = {
  async addComment (data: CommentInput): Promise<Comment> {
    const row = { ...data, like: data.like ?? 0, dislike: data.dislike ?? 0 }
    await db().insert(comments).values(row)
    return { ...data, relativeTime: relTime(data.created), children: [], replyCount: 0 } as any
  },

  async addComments (data: CommentInput[]): Promise<number> {
    if (data.length === 0) return 0
    const BATCH = 100
    const rows = data.map(d => ({ ...d, like: d.like ?? 0, dislike: d.dislike ?? 0 }))
    for (let i = 0; i < rows.length; i += BATCH) {
      await db().insert(comments).values(rows.slice(i, i + BATCH))
    }
    return rows.length
  },

  async getComment (id: string): Promise<Comment | undefined> {
    const rows = await db().select().from(comments).where(eq(comments.id, id)).limit(1)
    return rows[0] ? fromRow(rows[0]) : undefined
  },

  async updateComment (id: string, data: CommentUpdate): Promise<boolean> {
    const set: any = { ...data, updated: Date.now() }
    const result = await db().update(comments).set(set).where(eq(comments.id, id)).returning({ id: comments.id })
    return result.length > 0
  },

  async getComments (url: string, page = 1, pageSize = 10, sort: CommentSort = 'newest'): Promise<PaginatedResult<CommentListItem>> {
    const visibleStates: CommentState[] = ['visible', 'pending']
    const orderBy = sort === 'oldest'
      ? asc(comments.created)
      : sort === 'hottest'
        ? desc(comments.like)
        : desc(comments.created)

    const totalRows = await db().select({ count: drizzleCount() }).from(comments)
      .where(and(eq(comments.url, url), inArray(comments.state, visibleStates), sql`${comments.pid} IS NULL`))
    const total = totalRows[0]?.count ?? 0

    const rows = await db().select().from(comments)
      .where(and(eq(comments.url, url), inArray(comments.state, visibleStates), sql`${comments.pid} IS NULL`))
      .orderBy(orderBy)
      .limit(pageSize).offset((page - 1) * pageSize)

    const parentIds = rows.map(r => r.id)
    const replyMap = new Map<string, CommentListItem[]>()
    if (parentIds.length > 0) {
      const allReplies = await db().select().from(comments)
        .where(and(inArray(comments.pid, parentIds as string[]), inArray(comments.state, visibleStates)))
        .orderBy(asc(comments.created))
      for (const r of allReplies) {
        if (!replyMap.has(r.pid!)) replyMap.set(r.pid!, [])
        replyMap.get(r.pid!)!.push(stripPrivate(fromRow(r)) as CommentListItem)
      }
    }

    const data = rows.map(c => {
      const children = replyMap.get(c.id) || []
      return { ...stripPrivate(fromRow(c)), children, replyCount: children.length } as CommentListItem
    })

    return { data, total: Number(total) }
  },

  async getReplies (pid: string): Promise<CommentListItem[]> {
    const rows = await db().select().from(comments)
      .where(and(eq(comments.pid, pid), inArray(comments.state, ['visible', 'pending'])))
      .orderBy(asc(comments.created))
    return rows.map(r => stripPrivate(fromRow(r)) as CommentListItem)
  },

  async getCommentsCount (urls: string[]): Promise<CommentCount[]> {
    if (urls.length === 0) return []
    const rows = await db().select({ url: comments.url, count: drizzleCount() }).from(comments)
      .where(and(inArray(comments.url, urls as string[]), eq(comments.state, 'visible')))
      .groupBy(comments.url)
    return rows.map(r => ({ url: r.url, count: Number(r.count) }))
  },

  async getRecentComments (limit = 10): Promise<CommentListItem[]> {
    const rows = await db().select().from(comments)
      .where(eq(comments.state, 'visible'))
      .orderBy(desc(comments.created))
      .limit(limit)
    return rows.map(r => stripPrivate(fromRow(r)) as CommentListItem)
  },

  async getRawRecentComments (limit = 50): Promise<RawComment[]> {
    const rows = await db().select().from(comments)
      .orderBy(desc(comments.created))
      .limit(limit)
    return rows.map(r => fromRow(r) as RawComment)
  },

  async getCommentReactions (commentId: string): Promise<CommentReactionMap> {
    const rows = await db().select().from(commentReactions).where(eq(commentReactions.commentId, commentId))
    const result: CommentReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = { count: 0, ips: [] }
      result[r.emoji].count += 1
      result[r.emoji].ips.push(r.ip)
    }
    return result
  },

  async toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<CommentReactionMap> {
    const existingRows = await db().select().from(commentReactions)
      .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
      .limit(1)
    const existing = existingRows[0]
    if (existing) {
      if (existing.emoji === emoji) {
        await db().delete(commentReactions)
          .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
      } else {
        await db().update(commentReactions).set({ emoji })
          .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
      }
    } else {
      await db().insert(commentReactions).values({ commentId, emoji, ip, createdAt: Date.now() })
    }
    return commentStore.getCommentReactions(commentId)
  },

  async setCommentState (id: string, state: CommentState): Promise<boolean> {
    const result = await db().update(comments).set({ state }).where(eq(comments.id, id)).returning({ id: comments.id })
    return result.length > 0
  },

  hideComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.HIDDEN) },
  showComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.VISIBLE) },

  async deleteComment (id: string): Promise<boolean> {
    await db().transaction(async (tx) => {
      // Delete child comments (replies) first, then the parent
      await tx.delete(comments).where(eq(comments.pid, id))
      await tx.delete(comments).where(eq(comments.id, id))
    })
    return true
  },

  async setTop (id: string, isTop: boolean): Promise<boolean> {
    const result = await db().update(comments).set({ isTop }).where(eq(comments.id, id)).returning({ id: comments.id })
    return result.length > 0
  },

  async setSpam (id: string, isSpam = true): Promise<boolean> {
    const patch = isSpam
      ? { isSpam: true, state: COMMENT_STATE.SPAM }
      : { isSpam: false, state: COMMENT_STATE.VISIBLE }
    const result = await db().update(comments).set(patch).where(eq(comments.id, id)).returning({ id: comments.id })
    return result.length > 0
  },

  async getDashboardStats (): Promise<DashboardStats> {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const yesterdayTs = todayTs - 86400000
    const [totalRows, todayRows, yesterdayRows, pendingRows, spamRows, hiddenRows, topRows] = await Promise.all([
      db().select({ count: drizzleCount() }).from(comments),
      db().select({ count: drizzleCount() }).from(comments).where(sql`${comments.created} >= ${todayTs}`),
      db().select({ count: drizzleCount() }).from(comments).where(sql`${comments.created} >= ${yesterdayTs} and ${comments.created} < ${todayTs}`),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.state, COMMENT_STATE.PENDING)),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.isSpam, true)),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.state, COMMENT_STATE.HIDDEN)),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.isTop, true)),
    ])
    return {
      total: Number(totalRows[0]?.count ?? 0),
      today: Number(todayRows[0]?.count ?? 0),
      yesterday: Number(yesterdayRows[0]?.count ?? 0),
      pending: Number(pendingRows[0]?.count ?? 0),
      spam: Number(spamRows[0]?.count ?? 0),
      hidden: Number(hiddenRows[0]?.count ?? 0),
      topCount: Number(topRows[0]?.count ?? 0),
    }
  },

  async getDashboardTrend (days = 7): Promise<DashboardTrendItem[]> {
    const n = Math.min(Math.max(Math.floor(days), 1), 30)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const startTs = todayTs - (n - 1) * 86400000
    // 单次 GROUP BY 查询：按日期分组聚合，避免 N 次 COUNT(*)
    // PG 中 integer / integer = integer(floor)，行为与 SQLite 一致
    const rows = await db().select({
      dayStart: sql<number>`(${comments.created} / 86400000 * 86400000)`,
      count: drizzleCount(),
    }).from(comments)
      .where(sql`${comments.created} >= ${startTs}`)
      .groupBy(sql`(${comments.created} / 86400000)`)
    const map = new Map<number, number>()
    for (const r of rows) map.set(Number(r.dayStart), Number(r.count))
    const result: DashboardTrendItem[] = []
    for (let i = n - 1; i >= 0; i--) {
      const dayStart = todayTs - i * 86400000
      const d = new Date(dayStart)
      result.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        count: map.get(dayStart) ?? 0,
      })
    }
    return result
  },

  async setCommentIpRegion (id: string, ipRegion: string): Promise<boolean> {
    const result = await db().update(comments).set({ ipRegion }).where(eq(comments.id, id)).returning({ id: comments.id })
    return result.length > 0
  },

  async getAllComments (page = 1, pageSize = 20): Promise<PaginatedResult<Comment>> {
    const totalRows = await db().select({ count: drizzleCount() }).from(comments)
    const rows = await db().select().from(comments)
      .orderBy(desc(comments.created))
      .limit(pageSize).offset((page - 1) * pageSize)
    return { data: rows.map(r => fromRow(r)), total: Number(totalRows[0]?.count ?? 0) }
  },

  async searchComments (page = 1, pageSize = 20, searchStr = '', filter = 'all'): Promise<PaginatedResult<Comment>> {
    const conditions = []
    if (searchStr) {
      const kw = `%${searchStr.toLowerCase()}%`
      conditions.push(or(
        like(sql`LOWER(${comments.nick})`, kw),
        like(sql`LOWER(${comments.mail})`, kw),
        like(sql`LOWER(${comments.comment})`, kw),
        like(sql`LOWER(${comments.url})`, kw),
        like(comments.ip, kw)
      ))
    }
    if (filter === 'hidden') conditions.push(eq(comments.state, COMMENT_STATE.HIDDEN))
    else if (filter === 'spam') conditions.push(eq(comments.isSpam, true))
    else if (filter === 'pending') conditions.push(eq(comments.state, COMMENT_STATE.PENDING))
    else if (filter === 'visible') conditions.push(and(eq(comments.state, COMMENT_STATE.VISIBLE), eq(comments.isSpam, false)))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const totalRows = await db().select({ count: drizzleCount() }).from(comments).where(where)
    const rows = await db().select().from(comments)
      .where(where)
      .orderBy(desc(comments.created))
      .limit(pageSize).offset((page - 1) * pageSize)
    return { data: rows.map(r => fromRow(r)), total: Number(totalRows[0]?.count ?? 0) }
  },
}

export const configStore: ConfigStore = {
  async getConfig (): Promise<Record<string, unknown>> {
    const rows = await db().select().from(configs)
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      try { result[row.key] = JSON.parse(row.value) } catch { result[row.key] = row.value }
    }
    return result
  },

  async setConfig (key: string, value: unknown): Promise<void> {
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    await db().insert(configs).values({ key, value: val, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: configs.key, set: { value: val, updatedAt: Date.now() } })
  },

  async setManyConfig (data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await configStore.setConfig(key, value)
    }
  },

  async resetConfig (): Promise<void> {
    await db().delete(configs)
  },
}

export const visitorStore: VisitorStore = {
  async getVisitorCount (url: string, title?: string): Promise<VisitorCount> {
    const existingRows = await db().select().from(visitors).where(eq(visitors.url, url)).limit(1)
    const existing = existingRows[0]
    if (!existing) {
      await db().insert(visitors).values({ url, title: title || '', count: 1, updatedAt: Date.now() })
      return { url, time: 1, updatedAt: Date.now() }
    }
    const count = existing.count + 1
    await db().update(visitors).set({ count, updatedAt: Date.now(), ...(title ? { title } : {}) }).where(eq(visitors.url, url))
    return { url, time: count, updatedAt: Date.now() }
  },
}

export const sessionStore: SessionStore = {
  async createToken (): Promise<string> {
    const { randomUUID, createHash } = await import('node:crypto')
    const token = randomUUID()
    // 存储 sha256(token) 而非明文：DB 泄露不直接泄露可用 session token
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db().insert(sessions).values({ token: tokenHash, createdAt: Date.now() })
    return token
  },

  async validateToken (token: string): Promise<boolean> {
    if (!token) return false
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const rows = await db().select().from(sessions).where(eq(sessions.token, tokenHash)).limit(1)
    if (!rows[0]) return false
    // ponytail: 24h TTL, matches cleanupSessions window
    return Date.now() - rows[0].createdAt < 24 * 60 * 60 * 1000
  },

  async removeToken (token: string): Promise<void> {
    if (!token) return
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db().delete(sessions).where(eq(sessions.token, tokenHash))
  },

  async rotateToken (oldToken: string): Promise<string | null> {
    if (!oldToken) return null
    const { randomUUID, createHash } = await import('node:crypto')
    const oldHash = createHash('sha256').update(oldToken).digest('hex')
    // Validate old token exists and is not expired
    const rows = await db().select().from(sessions).where(eq(sessions.token, oldHash)).limit(1)
    if (!rows[0] || Date.now() - rows[0].createdAt > 24 * 60 * 60 * 1000) return null
    // Create new token and remove old one in a transaction
    const newToken = randomUUID()
    const newHash = createHash('sha256').update(newToken).digest('hex')
    await db().transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.token, oldHash))
      await tx.insert(sessions).values({ token: newHash, createdAt: Date.now() })
    })
    return newToken
  },

  async removeAllTokens (): Promise<void> {
    await db().delete(sessions)
  },

  async cleanupSessions (): Promise<void> {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    await db().delete(sessions).where(sql`${sessions.createdAt} < ${dayAgo}`)
  },
}

export const reactionStore: ReactionStore = {
  async getReactions (url: string): Promise<ReactionMap> {
    const rows = await db().select().from(reactions).where(eq(reactions.url, url))
    const result: ReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = []
      result[r.emoji].push(r.ip)
    }
    return result
  },

  async toggleReaction (url: string, emoji: string, ip: string): Promise<ReactionMap> {
    const existingRows = await db().select().from(reactions)
      .where(and(eq(reactions.url, url), eq(reactions.emoji, emoji), eq(reactions.ip, ip)))
      .limit(1)
    if (existingRows[0]) {
      await db().delete(reactions)
        .where(and(eq(reactions.url, url), eq(reactions.emoji, emoji), eq(reactions.ip, ip)))
    } else {
      await db().insert(reactions).values({ url, emoji, ip })
    }
    return reactionStore.getReactions(url)
  },
}

// ========== Full store export/import ==========

export async function getStore (): Promise<StoreSnapshot> {
  const allComments = (await db().select().from(comments)).map(r => fromRow(r))
  const allConfigs = await db().select().from(configs)
  const allVisitors = await db().select().from(visitors)
  const allSessions = await db().select().from(sessions)

  const store: StoreSnapshot = {
    comments: allComments,
    configs: {},
    visitors: {},
    sessions: allSessions.map(s => ({ token: s.token, createdAt: s.createdAt })),
    reactions: {},
    commentReactions: {},
  }
  for (const c of allConfigs) store.configs[c.key] = { value: c.value, updatedAt: c.updatedAt }
  for (const v of allVisitors) store.visitors[v.url] = { title: v.title || '', count: v.count, updatedAt: v.updatedAt }

  const allReactions = await db().select().from(reactions)
  const reactMap: Record<string, ReactionMap> = {}
  for (const r of allReactions) {
    if (!reactMap[r.url]) reactMap[r.url] = {}
    if (!reactMap[r.url][r.emoji]) reactMap[r.url][r.emoji] = []
    reactMap[r.url][r.emoji].push(r.ip)
  }
  store.reactions = reactMap

  const allCommentReactions = await db().select().from(commentReactions)
  const cReactMap: Record<string, ReactionMap> = {}
  for (const r of allCommentReactions) {
    if (!cReactMap[r.commentId]) cReactMap[r.commentId] = {}
    if (!cReactMap[r.commentId][r.emoji]) cReactMap[r.commentId][r.emoji] = []
    cReactMap[r.commentId][r.emoji].push(r.ip)
  }
  store.commentReactions = cReactMap

  return store
}

export async function importStore (data: StoreImportData): Promise<void> {
  // 单事务批量导入，避免逐条 insert 的事务开销
  await db().transaction(async (tx) => {
    if (data.comments) {
      for (const c of data.comments) {
        await tx.insert(comments).values({
          id: c.id,
          url: c.url,
          href: c.href,
          nick: c.nick,
          mail: c.mail,
          mailMd5: c.mailMd5,
          link: c.link,
          comment: c.comment,
          ua: c.ua,
          ip: c.ip,
          state: c.state || 'visible',
          created: c.created,
          updated: c.updated,
          pid: c.pid,
          rid: c.rid,
          like: c.like ?? 0,
          dislike: c.dislike ?? 0,
          // PG 原生 boolean，无需 0/1 转换
          isSpam: c.isSpam ?? false,
          isTop: c.isTop ?? false,
          isPinned: c.isPinned ?? false,
          image: c.image,
          sticker: c.sticker,
          ipRegion: c.ipRegion,
          tags: c.tags,
          renderedComment: c.renderedComment || null,
        }).onConflictDoNothing()
      }
    }
    if (data.configs) {
      for (const [key, val] of Object.entries(data.configs)) {
        await tx.insert(configs).values({ key, value: val.value, updatedAt: val.updatedAt || Date.now() })
          .onConflictDoUpdate({ target: configs.key, set: { value: val.value, updatedAt: Date.now() } })
      }
    }
    if (data.visitors) {
      for (const [url, v] of Object.entries(data.visitors)) {
        await tx.insert(visitors).values({ url, title: v.title, count: v.count, updatedAt: v.updatedAt })
          .onConflictDoUpdate({ target: visitors.url, set: { count: v.count, updatedAt: v.updatedAt } })
      }
    }
    if (data.reactions) {
      for (const [url, emojis] of Object.entries(data.reactions)) {
        for (const [emoji, ips] of Object.entries(emojis)) {
          for (const ip of ips) {
            await tx.insert(reactions).values({ url, emoji, ip }).onConflictDoNothing()
          }
        }
      }
    }
    if (data.commentReactions) {
      for (const [commentId, emojis] of Object.entries(data.commentReactions)) {
        for (const [emoji, ips] of Object.entries(emojis)) {
          for (const ip of ips) {
            await tx.insert(commentReactions).values({ commentId, emoji, ip, createdAt: Date.now() }).onConflictDoNothing()
          }
        }
      }
    }
  })
}

export async function ensureDb (): Promise<void> {
  await initDb()
}
