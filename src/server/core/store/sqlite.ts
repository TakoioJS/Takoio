import { getDb, initDb } from '../db/client'
import { comments, configs, visitors, sessions, reactions, commentReactions, rateLimits, users } from '../db/schema'
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
  User,
  UserRole,
} from './types'
import type {
  CommentStore,
  ConfigStore,
  VisitorStore,
  SessionStore,
  ReactionStore,
  UserStore,
} from './index'
import { COMMENT_STATE, relTime, stripPrivate, fromRow, commentToSqliteRow, BATCH_SIZE_SQLITE } from './utils'
import { buildGetCommentsQuery } from './query-helpers'

const db = () => getDb()

export const commentStore: CommentStore = {
  async addComment (data: CommentInput): Promise<Comment> {
    const row = commentToSqliteRow(data)
    await db().insert(comments).values(row).run()
    return { ...data, relativeTime: relTime(data.created), children: [], replyCount: 0 } as Comment
  },

  async addComments (data: CommentInput[]): Promise<number> {
    if (data.length === 0) return 0
    // 批量插入：分批避免 SQLite 参数上限，每批多行 INSERT 比 N 次单行快一个数量级
    const rows = data.map(commentToSqliteRow)
    for (let i = 0; i < rows.length; i += BATCH_SIZE_SQLITE) {
      await db().insert(comments).values(rows.slice(i, i + BATCH_SIZE_SQLITE)).run()
    }
    return rows.length
  },

  async getComment (id: string): Promise<Comment | undefined> {
    const row = await db().select().from(comments).where(eq(comments.id, id)).get()
    return row ? fromRow(row) : undefined
  },

  async updateComment (id: string, data: CommentUpdate): Promise<boolean> {
    const set: any = { ...data, updated: Date.now() }
    if ('isSpam' in set) set.isSpam = set.isSpam ? 1 : 0
    if ('isTop' in set) set.isTop = set.isTop ? 1 : 0
    const result = await db().update(comments).set(set).where(eq(comments.id, id)).run()
    return result.rowsAffected > 0
  },

  async getComments (url: string, page = 1, pageSize = 10, sort: CommentSort = 'newest'): Promise<PaginatedResult<CommentListItem>> {
    const q = buildGetCommentsQuery({ url, page, pageSize, sort })
    const orderCol = q.orderBy.column === 'created' ? comments.created : comments.like
    const orderBy = q.orderBy.direction === 'asc' ? asc(orderCol) : desc(orderCol)
    const where = and(
      eq(comments.url, q.where.url),
      inArray(comments.state, q.where.visibleStates),
      sql`${comments.pid} IS NULL`
    )

    const total = await db().select({ count: drizzleCount() }).from(comments)
      .where(where)
      .get()

    const rows = await db().select().from(comments)
      .where(where)
      .orderBy(orderBy)
      .limit(q.limit).offset(q.offset)
      .all()

    const parentIds = rows.map(r => r.id)
    const replyMap = new Map<string, CommentListItem[]>()
    if (parentIds.length > 0) {
      const allReplies = await db().select().from(comments)
        .where(and(inArray(comments.pid, parentIds as string[]), inArray(comments.state, q.where.visibleStates)))
        .orderBy(asc(comments.created))
        .all()
      for (const r of allReplies) {
        if (!replyMap.has(r.pid!)) replyMap.set(r.pid!, [])
        replyMap.get(r.pid!)!.push(stripPrivate(fromRow(r)) as CommentListItem)
      }
    }

    const data = rows.map(c => {
      const children = replyMap.get(c.id) || []
      return { ...stripPrivate(fromRow(c)), children, replyCount: children.length } as CommentListItem
    })

    return { data, total: total?.count ?? 0 }
  },

  async getReplies (pid: string): Promise<CommentListItem[]> {
    const rows = await db().select().from(comments)
      .where(and(eq(comments.pid, pid), inArray(comments.state, ['visible', 'pending'])))
      .orderBy(asc(comments.created))
      .all()
    return rows.map(r => stripPrivate(fromRow(r)) as CommentListItem)
  },

  async getCommentsCount (urls: string[]): Promise<CommentCount[]> {
    if (urls.length === 0) return []
    const rows = await db().select({ url: comments.url, count: drizzleCount() }).from(comments)
      .where(and(inArray(comments.url, urls as string[]), eq(comments.state, 'visible')))
      .groupBy(comments.url)
      .all()
    return rows.map(r => ({ url: r.url, count: r.count }))
  },

  async getRecentComments (limit = 10): Promise<CommentListItem[]> {
    const rows = await db().select().from(comments)
      .where(eq(comments.state, 'visible'))
      .orderBy(desc(comments.created))
      .limit(limit)
      .all()
    return rows.map(r => stripPrivate(fromRow(r)) as CommentListItem)
  },

  async getRawRecentComments (limit = 50): Promise<RawComment[]> {
    const rows = await db().select().from(comments)
      .orderBy(desc(comments.created))
      .limit(limit)
      .all()
    return rows.map(r => fromRow(r) as RawComment)
  },

  async getCommentReactions (commentId: string): Promise<CommentReactionMap> {
    const rows = await db().select().from(commentReactions).where(eq(commentReactions.commentId, commentId)).all()
    const result: CommentReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = { count: 0, ips: [] }
      result[r.emoji].count += 1
      result[r.emoji].ips.push(r.ip)
    }
    return result
  },

  async toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<CommentReactionMap> {
    const existing = await db().select().from(commentReactions)
      .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
      .get()
    if (existing) {
      if (existing.emoji === emoji) {
        await db().delete(commentReactions)
          .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
          .run()
      } else {
        await db().update(commentReactions).set({ emoji })
          .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.ip, ip)))
          .run()
      }
    } else {
      await db().insert(commentReactions).values({ commentId, emoji, ip, createdAt: Date.now() }).run()
    }
    return commentStore.getCommentReactions(commentId)
  },

  async setCommentState (id: string, state: CommentState): Promise<boolean> {
    const result = await db().update(comments).set({ state }).where(eq(comments.id, id)).run()
    return result.rowsAffected > 0
  },

  hideComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.HIDDEN) },
  showComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.VISIBLE) },

  async deleteComment (id: string): Promise<boolean> {
    await db().transaction(async (tx) => {
      // Delete child comments (replies) first, then the parent
      await tx.delete(comments).where(eq(comments.pid, id)).run()
      await tx.delete(comments).where(eq(comments.id, id)).run()
    })
    return true
  },

  async setTop (id: string, isTop: boolean): Promise<boolean> {
    const result = await db().update(comments).set({ isTop: isTop ? 1 : 0 }).where(eq(comments.id, id)).run()
    return result.rowsAffected > 0
  },

  async setSpam (id: string, isSpam = true): Promise<boolean> {
    const patch = isSpam
      ? { isSpam: 1, state: COMMENT_STATE.SPAM }
      : { isSpam: 0, state: COMMENT_STATE.VISIBLE }
    const result = await db().update(comments).set(patch).where(eq(comments.id, id)).run()
    return result.rowsAffected > 0
  },

  async getDashboardStats (): Promise<DashboardStats> {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const yesterdayTs = todayTs - 86400000
    const [total, today, yesterday, pending, spam, hidden, topCount] = await Promise.all([
      db().select({ count: drizzleCount() }).from(comments).get(),
      db().select({ count: drizzleCount() }).from(comments).where(sql`${comments.created} >= ${todayTs}`).get(),
      db().select({ count: drizzleCount() }).from(comments).where(sql`${comments.created} >= ${yesterdayTs} and ${comments.created} < ${todayTs}`).get(),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.state, COMMENT_STATE.PENDING)).get(),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.isSpam, 1)).get(),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.state, COMMENT_STATE.HIDDEN)).get(),
      db().select({ count: drizzleCount() }).from(comments).where(eq(comments.isTop, 1)).get(),
    ])
    return {
      total: total?.count ?? 0,
      today: today?.count ?? 0,
      yesterday: yesterday?.count ?? 0,
      pending: pending?.count ?? 0,
      spam: spam?.count ?? 0,
      hidden: hidden?.count ?? 0,
      topCount: topCount?.count ?? 0,
    }
  },

  async getDashboardTrend (days = 7): Promise<DashboardTrendItem[]> {
    const n = Math.min(Math.max(Math.floor(days), 1), 30)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const startTs = todayTs - (n - 1) * 86400000
    // 单次 GROUP BY 查询：按日期分组聚合，避免 N 次 COUNT(*)
    const rows = await db().select({
      dayStart: sql<number>`(${comments.created} / 86400000 * 86400000)`,
      count: drizzleCount(),
    }).from(comments)
      .where(sql`${comments.created} >= ${startTs}`)
      .groupBy(sql`(${comments.created} / 86400000)`)
      .all()
    const map = new Map<number, number>()
    for (const r of rows) map.set(r.dayStart, r.count)
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
    const result = await db().update(comments).set({ ipRegion }).where(eq(comments.id, id)).run()
    return result.rowsAffected > 0
  },

  async getAllComments (page = 1, pageSize = 20): Promise<PaginatedResult<Comment>> {
    const total = await db().select({ count: drizzleCount() }).from(comments).get()
    const rows = await db().select().from(comments)
      .orderBy(desc(comments.created))
      .limit(pageSize).offset((page - 1) * pageSize)
      .all()
    return { data: rows.map(r => fromRow(r)), total: total?.count ?? 0 }
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
    else if (filter === 'spam') conditions.push(eq(comments.isSpam, 1))
    else if (filter === 'pending') conditions.push(eq(comments.state, COMMENT_STATE.PENDING))
    else if (filter === 'visible') conditions.push(and(eq(comments.state, COMMENT_STATE.VISIBLE), eq(comments.isSpam, 0)))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const total = await db().select({ count: drizzleCount() }).from(comments).where(where).get()
    const rows = await db().select().from(comments)
      .where(where)
      .orderBy(desc(comments.created))
      .limit(pageSize).offset((page - 1) * pageSize)
      .all()
    return { data: rows.map(r => fromRow(r)), total: total?.count ?? 0 }
  },
}

export const configStore: ConfigStore = {
  async getConfig (): Promise<Record<string, unknown>> {
    const rows = await db().select().from(configs).all()
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
      .run()
  },

  async setManyConfig (data: Record<string, unknown>): Promise<void> {
    // Wrap in a transaction to ensure atomicity: all-or-nothing config update.
    await db().transaction(async (tx) => {
      for (const [key, value] of Object.entries(data)) {
        const val = typeof value === 'string' ? value : JSON.stringify(value)
        await tx.insert(configs).values({ key, value: val, updatedAt: Date.now() })
          .onConflictDoUpdate({ target: configs.key, set: { value: val, updatedAt: Date.now() } })
          .run()
      }
    })
  },

  async resetConfig (): Promise<void> {
    await db().delete(configs).run()
  },
}

export const visitorStore: VisitorStore = {
  async getVisitorCount (url: string, title?: string): Promise<VisitorCount> {
    // Use atomic UPSERT: insert with count=1, or update count = count + 1 on conflict.
    // This eliminates the read-modify-write race condition.
    const now = Date.now()
    await db().insert(visitors).values({ url, title: title || '', count: 1, updatedAt: now }).run()
      .catch(() => {
        // Conflict expected when row exists; fall through to atomic update
      })
    // After ensuring row exists, perform atomic increment
    await db().run(
      sql`UPDATE ${visitors} SET count = count + 1, updated_at = ${now}${title ? sql`, title = ${title}` : sql``} WHERE ${visitors.url} = ${url}`
    )
    // Fetch the updated count
    const row = await db().select({ count: visitors.count }).from(visitors).where(eq(visitors.url, url)).get()
    return { url, time: row?.count ?? 1, updatedAt: now }
  },
}

export const sessionStore: SessionStore = {
  async createToken (): Promise<string> {
    const { randomUUID, createHash } = await import('node:crypto')
    const token = randomUUID()
    // 存储 sha256(token) 而非明文：DB 泄露不直接泄露可用 session token
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db().insert(sessions).values({ token: tokenHash, createdAt: Date.now() }).run()
    return token
  },

  async validateToken (token: string): Promise<boolean> {
    if (!token) return false
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const row = await db().select().from(sessions).where(eq(sessions.token, tokenHash)).get()
    if (!row) return false
    // ponytail: 24h TTL, matches cleanupSessions window
    return Date.now() - row.createdAt < 24 * 60 * 60 * 1000
  },

  async removeToken (token: string): Promise<void> {
    if (!token) return
    const { createHash } = await import('node:crypto')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await db().delete(sessions).where(eq(sessions.token, tokenHash)).run()
  },

  async rotateToken (oldToken: string): Promise<string | null> {
    if (!oldToken) return null
    const { randomUUID, createHash } = await import('node:crypto')
    const oldHash = createHash('sha256').update(oldToken).digest('hex')
    const newToken = randomUUID()
    const newHash = createHash('sha256').update(newToken).digest('hex')
    const now = Date.now()
    const ttl = 24 * 60 * 60 * 1000
    // Atomic: delete old token only if it exists and is not expired, then insert new token.
    // Using a raw SQL statement to perform the check-and-swap atomically.
    const result = await db().run(
      sql`DELETE FROM ${sessions} WHERE ${sessions.token} = ${oldHash} AND ${sessions.createdAt} > ${now - ttl}`
    )
    // If no row was deleted, the old token was invalid or expired.
    if (result.rowsAffected === 0) return null
    await db().insert(sessions).values({ token: newHash, createdAt: now }).run()
    return newToken
  },

  async removeAllTokens (): Promise<void> {
    await db().delete(sessions).run()
  },

  async cleanupSessions (): Promise<void> {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    await db().delete(sessions).where(sql`${sessions.createdAt} < ${dayAgo}`).run()
  },
}

export const reactionStore: ReactionStore = {
  async getReactions (url: string): Promise<ReactionMap> {
    const rows = await db().select().from(reactions).where(eq(reactions.url, url)).all()
    const result: ReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = []
      result[r.emoji].push(r.ip)
    }
    return result
  },

  async toggleReaction (url: string, emoji: string, ip: string): Promise<ReactionMap> {
    // Atomic UPSERT: insert the reaction; on conflict (already exists) delete it.
    // This eliminates the read-modify-write race condition.
    try {
      await db().insert(reactions).values({ url, emoji, ip }).run()
    } catch {
      // Conflict means the reaction already exists; delete it atomically.
      await db().delete(reactions)
        .where(and(eq(reactions.url, url), eq(reactions.emoji, emoji), eq(reactions.ip, ip)))
        .run()
    }
    return reactionStore.getReactions(url)
  },
}

export const userStore: UserStore = {
  async upsertUser (data): Promise<User> {
    const { randomUUID } = await import('node:crypto')
    const now = Date.now()
    // try insert; on conflict (provider+providerId), update name/email/avatar/lastLoginAt/loginCount
    try {
      const id = randomUUID()
      await db().insert(users).values({
        id,
        provider: data.provider,
        providerId: data.providerId,
        email: data.email,
        name: data.name,
        avatar: data.avatar || null,
        role: 'user',
        createdAt: now,
        lastLoginAt: now,
        loginCount: 1,
      }).run()
      const row = await db().select().from(users).where(eq(users.id, id)).get()
      return row as User
    } catch {
      // conflict — update login info
      const existing = await db().select().from(users)
        .where(and(eq(users.provider, data.provider), eq(users.providerId, data.providerId)))
        .get()
      if (existing) {
        await db().update(users).set({
          name: data.name,
          email: data.email,
          avatar: data.avatar || null,
          lastLoginAt: now,
          loginCount: existing.loginCount + 1,
        }).where(eq(users.id, existing.id)).run()
        return { ...existing, name: data.name, email: data.email, avatar: data.avatar || undefined, lastLoginAt: now, loginCount: existing.loginCount + 1 } as User
      }
      throw new Error('upsertUser: insert failed and no existing user found')
    }
  },

  async getUsers (page = 1, pageSize = 20, search = '', filter = ''): Promise<PaginatedResult<User>> {
    const conditions = []
    if (search) {
      const kw = `%${search.toLowerCase()}%`
      conditions.push(or(
        like(sql`LOWER(${users.name})`, kw),
        like(sql`LOWER(${users.email})`, kw),
      ))
    }
    if (filter === 'banned') conditions.push(eq(users.role, 'banned'))
    else if (filter === 'user') conditions.push(eq(users.role, 'user'))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const total = await db().select({ count: drizzleCount() }).from(users).where(where).get()
    const rows = await db().select().from(users)
      .where(where)
      .orderBy(desc(users.lastLoginAt))
      .limit(pageSize).offset((page - 1) * pageSize)
      .all()
    return { data: rows as User[], total: total?.count ?? 0 }
  },

  async getUser (id: string): Promise<User | undefined> {
    const row = await db().select().from(users).where(eq(users.id, id)).get()
    return row as User | undefined
  },

  async getUserByEmail (email: string): Promise<User | undefined> {
    const row = await db().select().from(users).where(eq(users.email, email.toLowerCase())).get()
    return row as User | undefined
  },

  async setUserRole (id: string, role: UserRole): Promise<boolean> {
    const result = await db().update(users).set({ role }).where(eq(users.id, id)).run()
    return result.rowsAffected > 0
  },

  async getUserCount (): Promise<number> {
    const row = await db().select({ count: drizzleCount() }).from(users).get()
    return row?.count ?? 0
  },
}

// ========== Full store export/import ==========

export async function getStore (): Promise<StoreSnapshot> {
  const allComments = (await db().select().from(comments).all()).map(r => fromRow(r))
  const allConfigs = await db().select().from(configs).all()
  const allVisitors = await db().select().from(visitors).all()
  const allSessions = await db().select().from(sessions).all()

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

  const allReactions = await db().select().from(reactions).all()
  const reactMap: Record<string, ReactionMap> = {}
  for (const r of allReactions) {
    if (!reactMap[r.url]) reactMap[r.url] = {}
    if (!reactMap[r.url][r.emoji]) reactMap[r.url][r.emoji] = []
    reactMap[r.url][r.emoji].push(r.ip)
  }
  store.reactions = reactMap

  const allCommentReactions = await db().select().from(commentReactions).all()
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
          isSpam: c.isSpam ? 1 : 0,
          isTop: c.isTop ? 1 : 0,
          isPinned: c.isPinned ? 1 : 0,
          image: c.image,
          sticker: c.sticker,
          ipRegion: c.ipRegion,
          tags: c.tags,
          renderedComment: c.renderedComment || null,
        }).onConflictDoNothing().run()
      }
    }
    if (data.configs) {
      for (const [key, val] of Object.entries(data.configs)) {
        await tx.insert(configs).values({ key, value: val.value, updatedAt: val.updatedAt || Date.now() })
          .onConflictDoUpdate({ target: configs.key, set: { value: val.value, updatedAt: Date.now() } })
          .run()
      }
    }
    if (data.visitors) {
      for (const [url, v] of Object.entries(data.visitors)) {
        await tx.insert(visitors).values({ url, title: v.title, count: v.count, updatedAt: v.updatedAt })
          .onConflictDoUpdate({ target: visitors.url, set: { count: v.count, updatedAt: v.updatedAt } })
          .run()
      }
    }
    if (data.reactions) {
      for (const [url, emojis] of Object.entries(data.reactions)) {
        for (const [emoji, ips] of Object.entries(emojis)) {
          for (const ip of ips) {
            await tx.insert(reactions).values({ url, emoji, ip })
              .onConflictDoNothing().run()
          }
        }
      }
    }
    if (data.commentReactions) {
      for (const [commentId, emojis] of Object.entries(data.commentReactions)) {
        for (const [emoji, ips] of Object.entries(emojis)) {
          for (const ip of ips) {
            await tx.insert(commentReactions).values({ commentId, emoji, ip, createdAt: Date.now() })
              .onConflictDoNothing().run()
          }
        }
      }
    }
  })
}

export async function ensureDb (): Promise<void> {
  await initDb()
}

// ========== DB-based Rate Limiting (phase 1: sqlite) ==========

export async function dbRateLimit (
  key: string,
  maxRequests: number,
  _windowMs: number,
  windowStart: number
): Promise<boolean> {
  if (maxRequests <= 0) return false
  // 原子化 upsert：INSERT 新窗口计数为 1；若存在冲突且当前 count < max，则 +1。
  // 当 count >= max 时 WHERE 条件不成立，rowsAffected = 0，直接返回 false。
  const result = await db().run(sql`
    INSERT INTO ${rateLimits} (key, window_start, count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT(key, window_start) DO UPDATE SET
      count = count + 1
    WHERE count < ${maxRequests}
  `)
  return (result.rowsAffected ?? 0) > 0
}
