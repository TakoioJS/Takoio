import { MongoClient, type Db, type Collection } from 'mongodb'
import { randomUUID, createHash } from 'node:crypto'
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
import { COMMENT_STATE } from './utils'

type Col = Collection<any>

const col = (db: Db, name: string): Col => db.collection<any>(name)

let _client: MongoClient | null = null
let _db: Db | null = null

import { MONGODB_URI, MONGODB_DB } from '../env'

const connUri = () => MONGODB_URI || 'mongodb://localhost:27017'
const dbName = () => MONGODB_DB || 'takoio'

let _connectPromise: Promise<Db> | null = null

async function getDb (): Promise<Db> {
  if (_db) return _db
  if (_connectPromise) return _connectPromise

  _connectPromise = (async () => {
    _client = new MongoClient(connUri(), {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
      retryWrites: true,
      retryReads: true,
    })
    await _client.connect()
    _db = _client.db(dbName())
    _client.on('close', () => { _db = null; _connectPromise = null })
    return _db
  })()

  return _connectPromise
}

const relTime = (ts: number): string => {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(ts).toLocaleDateString()
}

/** 移除隐私字段（ip/mail）并附加 relativeTime */
const stripPrivate = (r: Comment | null): Omit<Comment, 'ip' | 'mail'> & { relativeTime: string } | null => {
  if (!r) return r
  const { ip: _ip, mail: _mail, ...rest } = r
  return { ...rest, relativeTime: relTime(rest.created) }
}

/** MongoDB 文档 → 归一化 Comment（_id → id） */
const normalizeDoc = (r: any): Comment | null => {
  if (!r) return r
  const { _id, ...rest } = r
  return {
    id: _id,
    ...rest,
    like: r.like ?? 0,
    dislike: r.dislike ?? 0,
    isSpam: !!r.isSpam,
    isTop: !!r.isTop,
    isPinned: !!r.isPinned,
    isPrivate: !!r.isPrivate,
  } as Comment
}

/** CommentInput → MongoDB 文档（addComment / addComments 共用） */
const commentToDoc = (data: CommentInput) => ({
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
  state: data.state || 'visible',
  created: data.created,
  updated: data.updated,
  pid: data.pid,
  rid: data.rid,
  like: data.like ?? 0,
  dislike: data.dislike ?? 0,
  isSpam: !!data.isSpam,
  isTop: !!data.isTop,
  isPinned: !!data.isPinned,
  isPrivate: !!data.isPrivate,
  image: data.image,
  sticker: data.sticker,
  ipRegion: data.ipRegion,
  tags: data.tags,
  renderedComment: data.renderedComment || null,
})

export const commentStore: CommentStore = {
  async addComment (data: CommentInput): Promise<Comment> {
    const db = await getDb()
    await col(db, 'comments').insertOne(commentToDoc(data))
    return { ...data, relativeTime: relTime(data.created), children: [], replyCount: 0 } as Comment
  },

  async addComments (data: CommentInput[]): Promise<number> {
    if (data.length === 0) return 0
    const db = await getDb()
    // bulkWrite 用 replaceOne + upsert 兼容已有 _id 的幂等导入；ordered:false 并行执行更快
    const ops = data.map(d => ({
      replaceOne: {
        filter: { _id: d.id },
        replacement: commentToDoc(d),
        upsert: true,
      },
    }))
    const BATCH = 500
    for (let i = 0; i < ops.length; i += BATCH) {
      await col(db, 'comments').bulkWrite(ops.slice(i, i + BATCH), { ordered: false })
    }
    return data.length
  },

  async getComment (id: string): Promise<Comment | undefined> {
    const db = await getDb()
    const doc = await col(db, 'comments').findOne({ _id: id })
    return doc ? normalizeDoc(doc) ?? undefined : undefined
  },

  async updateComment (id: string, data: CommentUpdate): Promise<boolean> {
    const db = await getDb()
    const set: any = { ...data, updated: Date.now() }
    if ('isSpam' in set) set.isSpam = !!set.isSpam
    if ('isTop' in set) set.isTop = !!set.isTop
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: set })
    return result.matchedCount > 0
  },

  async getComments (url: string, page = 1, pageSize = 10, sort: CommentSort = 'newest'): Promise<PaginatedResult<CommentListItem>> {
    const db = await getDb()
    const visibleStates: CommentState[] = ['visible', 'pending']
    const sortOrder: Record<string, 1 | -1> = sort === 'oldest'
      ? { created: 1 }
      : sort === 'hottest'
        ? { like: -1 }
        : { created: -1 }
    const query = { url, state: { $in: visibleStates }, pid: null }

    const total = await col(db, 'comments').countDocuments(query)
    const rows = await col(db, 'comments').find(query)
      .sort(sortOrder).skip((page - 1) * pageSize).limit(pageSize).toArray()

    const parentIds = rows.map(r => r._id)
    const replyMap = new Map<string, CommentListItem[]>()
    if (parentIds.length > 0) {
      const allReplies = await col(db, 'comments').find({ pid: { $in: parentIds }, state: { $in: visibleStates } })
        .sort({ created: 1 }).toArray()
      for (const r of allReplies) {
        if (!replyMap.has(r.pid)) replyMap.set(r.pid, [])
        replyMap.get(r.pid)!.push(stripPrivate(normalizeDoc(r)) as CommentListItem)
      }
    }

    const data = rows.map(c => {
      const children = replyMap.get(c._id) || []
      return { ...stripPrivate(normalizeDoc(c)), children, replyCount: children.length } as CommentListItem
    })

    return { data, total }
  },

  async getReplies (pid: string): Promise<CommentListItem[]> {
    const db = await getDb()
    const rows = await col(db, 'comments').find({ pid, state: { $in: ['visible', 'pending'] } })
      .sort({ created: 1 }).toArray()
    return rows.map(r => stripPrivate(normalizeDoc(r)) as CommentListItem)
  },

  async getCommentsCount (urls: string[]): Promise<CommentCount[]> {
    if (urls.length === 0) return []
    const db = await getDb()
    const counts = await col(db, 'comments').aggregate([
      { $match: { url: { $in: urls }, state: 'visible' } },
      { $group: { _id: '$url', count: { $sum: 1 } } },
    ]).toArray()
    const map = new Map(counts.map(c => [c._id, c.count]))
    return urls.map(url => ({ url, count: map.get(url) ?? 0 }))
  },

  async getRecentComments (limit = 10): Promise<CommentListItem[]> {
    const db = await getDb()
    const rows = await col(db, 'comments').find({ state: 'visible' })
      .sort({ created: -1 }).limit(limit).toArray()
    return rows.map(r => stripPrivate(normalizeDoc(r)) as CommentListItem)
  },

  async getRawRecentComments (limit = 50): Promise<RawComment[]> {
    const db = await getDb()
    const rows = await col(db, 'comments').find({})
      .sort({ created: -1 }).limit(limit).toArray()
    return rows.map(r => normalizeDoc(r) as RawComment)
  },

  async getCommentReactions (commentId: string): Promise<CommentReactionMap> {
    const db = await getDb()
    const rows = await col(db, 'comment_reactions').find({ commentId }).toArray()
    const result: CommentReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = { count: 0, ips: [] }
      result[r.emoji].count += 1
      result[r.emoji].ips.push(r.ip)
    }
    return result
  },

  async toggleCommentReaction (commentId: string, emoji: string, ip: string): Promise<CommentReactionMap> {
    const db = await getDb()
    const coll = col(db, 'comment_reactions')
    const existing = await coll.findOne({ commentId, ip })
    if (existing) {
      if (existing.emoji === emoji) {
        await coll.deleteOne({ commentId, ip })
      } else {
        await coll.updateOne({ commentId, ip }, { $set: { emoji } })
      }
    } else {
      await coll.insertOne({ commentId, emoji, ip, createdAt: Date.now() })
    }
    return commentStore.getCommentReactions(commentId)
  },

  async setCommentState (id: string, state: CommentState): Promise<boolean> {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { state } })
    return result.matchedCount > 0
  },

  hideComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.HIDDEN) },
  showComment (id: string): Promise<boolean> { return commentStore.setCommentState(id, COMMENT_STATE.VISIBLE) },

  async deleteComment (id: string): Promise<boolean> {
    const db = await getDb()
    await col(db, 'comments').deleteMany({ $or: [{ _id: id }, { pid: id }] })
    return true
  },

  async setTop (id: string, isTop: boolean): Promise<boolean> {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { isTop } })
    return result.matchedCount > 0
  },

  async setSpam (id: string, isSpam = true): Promise<boolean> {
    const db = await getDb()
    const patch = isSpam
      ? { isSpam: true, state: COMMENT_STATE.SPAM }
      : { isSpam: false, state: COMMENT_STATE.VISIBLE }
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: patch })
    return result.matchedCount > 0
  },

  async getDashboardStats (): Promise<DashboardStats> {
    const db = await getDb()
    const coll = col(db, 'comments')
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const yesterdayTs = todayTs - 86400000
    const [total, today, yesterday, pending, spam, hidden, topCount] = await Promise.all([
      coll.countDocuments(),
      coll.countDocuments({ created: { $gte: todayTs } }),
      coll.countDocuments({ created: { $gte: yesterdayTs, $lt: todayTs } }),
      coll.countDocuments({ state: COMMENT_STATE.PENDING }),
      coll.countDocuments({ isSpam: true }),
      coll.countDocuments({ state: COMMENT_STATE.HIDDEN }),
      coll.countDocuments({ isTop: true }),
    ])
    return { total, today, yesterday, pending, spam, hidden, topCount }
  },

  async getDashboardTrend (days = 7): Promise<DashboardTrendItem[]> {
    const db = await getDb()
    const coll = col(db, 'comments')
    const n = Math.min(Math.max(Math.floor(days), 1), 30)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayTs = startOfToday.getTime()
    const startTs = todayTs - (n - 1) * 86400000
    // 单次 aggregate：按日期分组聚合，避免 N 次 countDocuments
    const rows = await coll.aggregate<{
      _id: number
      count: number
    }>([
      { $match: { created: { $gte: startTs } } },
      { $group: { _id: { $floor: { $divide: ['$created', 86400000] } }, count: { $sum: 1 } } },
    ]).toArray()
    const map = new Map<number, number>()
    for (const r of rows) map.set(r._id * 86400000, r.count)
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
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { ipRegion } })
    return result.matchedCount > 0
  },

  async getAllComments (page = 1, pageSize = 20): Promise<PaginatedResult<Comment>> {
    const db = await getDb()
    const coll = col(db, 'comments')
    const total = await coll.countDocuments()
    const rows = await coll.find({}).sort({ created: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
    return { data: rows.map(r => normalizeDoc(r) as Comment), total }
  },

  async searchComments (page = 1, pageSize = 20, searchStr = '', filter = 'all'): Promise<PaginatedResult<Comment>> {
    const db = await getDb()
    const filterDoc: any = {}

    if (searchStr) {
      const kw = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filterDoc.$or = [
        { nick: { $regex: kw, $options: 'i' } },
        { mail: { $regex: kw, $options: 'i' } },
        { comment: { $regex: kw, $options: 'i' } },
        { url: { $regex: kw, $options: 'i' } },
        { ip: { $regex: kw, $options: 'i' } },
      ]
    }
    if (filter === 'hidden') filterDoc.state = COMMENT_STATE.HIDDEN
    else if (filter === 'spam') filterDoc.isSpam = true
    else if (filter === 'pending') filterDoc.state = COMMENT_STATE.PENDING
    else if (filter === 'visible') { filterDoc.state = COMMENT_STATE.VISIBLE; filterDoc.isSpam = false }

    const coll = col(db, 'comments')
    const total = await coll.countDocuments(filterDoc)
    const rows = await coll.find(filterDoc).sort({ created: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
    return { data: rows.map(r => normalizeDoc(r) as Comment), total }
  },
}

export const configStore: ConfigStore = {
  async getConfig (): Promise<Record<string, unknown>> {
    const db = await getDb()
    const rows = await col(db, 'configs').find({}).toArray()
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      try { result[row._id] = JSON.parse(row.value) } catch { result[row._id] = row.value }
    }
    return result
  },

  async setConfig (key: string, value: unknown): Promise<void> {
    const db = await getDb()
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    await col(db, 'configs').replaceOne(
      { _id: key },
      { _id: key, value: val, updatedAt: Date.now() },
      { upsert: true }
    )
  },

  async setManyConfig (data: Record<string, unknown>): Promise<void> {
    // Use a client session (transaction) to ensure atomicity: all-or-nothing config update.
    const db = await getDb()
    const session = (await getDb()).client.startSession()
    try {
      await session.withTransaction(async () => {
        for (const [key, value] of Object.entries(data)) {
          const val = typeof value === 'string' ? value : JSON.stringify(value)
          await col(db, 'configs').replaceOne(
            { _id: key },
            { _id: key, value: val, updatedAt: Date.now() },
            { upsert: true, session }
          )
        }
      })
    } finally {
      await session.endSession()
    }
  },

  async resetConfig (): Promise<void> {
    const db = await getDb()
    await col(db, 'configs').deleteMany({})
  },
}

export const visitorStore: VisitorStore = {
  async getVisitorCount (url: string, title?: string): Promise<VisitorCount> {
    const db = await getDb()
    const coll = col(db, 'visitors')
    const now = Date.now()
    // Atomic find-and-modify: upsert on first visit, otherwise $inc count atomically.
    // This eliminates the read-modify-write race condition.
    const result = await coll.findOneAndUpdate(
      { _id: url },
      {
        $inc: { count: 1 },
        $setOnInsert: { title: title || '', updatedAt: now },
        ...(title ? { $set: { title, updatedAt: now } } : {}),
      },
      { upsert: true, returnDocument: 'after' }
    )
    return { url, time: result?.count ?? 1, updatedAt: now }
  },
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Normalize createdAt to a timestamp (ms), handling both Date objects and legacy numbers */
const toMs = (v: Date | number): number =>
  v instanceof Date ? v.getTime() : (typeof v === 'number' ? v : 0)

export const sessionStore: SessionStore = {
  async createToken (): Promise<string> {
    const db = await getDb()
    const token = randomUUID()
    // 存储 sha256(token) 而非明文：DB 泄露不直接泄露可用 session token
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await col(db, 'sessions').insertOne({ _id: tokenHash, createdAt: new Date() })
    return token
  },

  async validateToken (token: string): Promise<boolean> {
    if (!token) return false
    const db = await getDb()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const row = await col(db, 'sessions').findOne({ _id: tokenHash })
    if (!row) return false
    return Date.now() - toMs(row.createdAt) < SESSION_TTL_MS
  },

  async removeToken (token: string): Promise<void> {
    if (!token) return
    const db = await getDb()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await col(db, 'sessions').deleteOne({ _id: tokenHash })
  },

  async cleanupSessions (): Promise<void> {
    const db = await getDb()
    const cutoff = new Date(Date.now() - SESSION_TTL_MS)
    // Handle both new Date-type and legacy numeric createdAt
    await col(db, 'sessions').deleteMany({
      $or: [
        { createdAt: { $lt: cutoff } },
        { createdAt: { $lt: Date.now() - SESSION_TTL_MS } },
      ],
    })
  },

  async removeAllTokens (): Promise<void> {
    const db = await getDb()
    await col(db, 'sessions').deleteMany({})
  },

  async rotateToken (oldToken: string): Promise<string | null> {
    if (!oldToken) return null
    const db = await getDb()
    const oldHash = createHash('sha256').update(oldToken).digest('hex')
    const newToken = randomUUID()
    const newHash = createHash('sha256').update(newToken).digest('hex')
    const cutoff = Date.now() - SESSION_TTL_MS
    // Atomic check-and-swap: findAndModify deletes the old token only if it exists and is not expired.
    const result = await col(db, 'sessions').findOneAndDelete(
      { _id: oldHash, createdAt: { $gte: new Date(cutoff) } }
    )
    // If no matching document was found and deleted, the old token was invalid or expired.
    if (!result) return null
    await col(db, 'sessions').insertOne({ _id: newHash, createdAt: new Date() })
    return newToken
  },
}

export const reactionStore: ReactionStore = {
  async getReactions (url: string): Promise<ReactionMap> {
    const db = await getDb()
    const rows = await col(db, 'reactions').find({ url }).toArray()
    const result: ReactionMap = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = []
      result[r.emoji].push(r.ip)
    }
    return result
  },

  async toggleReaction (url: string, emoji: string, ip: string): Promise<ReactionMap> {
    const db = await getDb()
    const coll = col(db, 'reactions')
    // Atomic find-and-delete: if the reaction exists, delete it; otherwise insert it.
    // Using the result of deleteOne to determine whether to insert.
    const deleteResult = await coll.deleteOne({ url, emoji, ip })
    if (deleteResult.deletedCount === 0) {
      // Reaction did not exist; insert it. Ignore duplicate key errors from race conditions.
      try {
        await coll.insertOne({ url, emoji, ip })
      } catch (e: any) {
        if (!e?.message?.includes('E11000')) throw e
      }
    }
    return reactionStore.getReactions(url)
  },
}

export const userStore: UserStore = {
  async upsertUser (data): Promise<User> {
    const db = await getDb()
    const coll = col(db, 'users')
    const now = Date.now()
    // Atomic upsert: find by provider+providerId, update or insert
    const existing = await coll.findOne({ provider: data.provider, providerId: data.providerId })
    if (existing) {
      await coll.updateOne(
        { _id: existing._id },
        {
          $set: { name: data.name, email: data.email, avatar: data.avatar || null, lastLoginAt: now },
          $inc: { loginCount: 1 },
        }
      )
      return {
        id: existing._id,
        provider: existing.provider,
        providerId: existing.providerId,
        email: data.email,
        name: data.name,
        avatar: data.avatar || null,
        role: existing.role || 'user',
        createdAt: existing.createdAt,
        lastLoginAt: now,
        loginCount: (existing.loginCount || 1) + 1,
      } as User
    }
    const { randomUUID } = await import('node:crypto')
    const id = randomUUID()
    await coll.insertOne({
      _id: id,
      provider: data.provider,
      providerId: data.providerId,
      email: data.email,
      name: data.name,
      avatar: data.avatar || null,
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
      loginCount: 1,
    })
    return {
      id, provider: data.provider, providerId: data.providerId,
      email: data.email, name: data.name, avatar: data.avatar || null,
      role: 'user', createdAt: now, lastLoginAt: now, loginCount: 1,
    } as User
  },

  async getUsers (page = 1, pageSize = 20, search = '', filter = ''): Promise<PaginatedResult<User>> {
    const db = await getDb()
    const coll = col(db, 'users')
    const filterDoc: any = {}
    if (search) {
      const kw = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filterDoc.$or = [
        { name: { $regex: kw, $options: 'i' } },
        { email: { $regex: kw, $options: 'i' } },
      ]
    }
    if (filter === 'banned') filterDoc.role = 'banned'
    else if (filter === 'user') filterDoc.role = 'user'
    const total = await coll.countDocuments(filterDoc)
    const rows = await coll.find(filterDoc)
      .sort({ lastLoginAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
    const data: User[] = rows.map(r => ({
      id: r._id, provider: r.provider, providerId: r.providerId,
      email: r.email, name: r.name, avatar: r.avatar || null,
      role: r.role || 'user', createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt, loginCount: r.loginCount ?? 1,
    }))
    return { data, total }
  },

  async getUser (id: string): Promise<User | undefined> {
    const db = await getDb()
    const r = await col(db, 'users').findOne({ _id: id })
    if (!r) return undefined
    return {
      id: r._id, provider: r.provider, providerId: r.providerId,
      email: r.email, name: r.name, avatar: r.avatar || null,
      role: r.role || 'user', createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt, loginCount: r.loginCount ?? 1,
    } as User
  },

  async getUserByEmail (email: string): Promise<User | undefined> {
    const db = await getDb()
    const r = await col(db, 'users').findOne({ email: email.toLowerCase() })
    if (!r) return undefined
    return {
      id: r._id, provider: r.provider, providerId: r.providerId,
      email: r.email, name: r.name, avatar: r.avatar || null,
      role: r.role || 'user', createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt, loginCount: r.loginCount ?? 1,
    } as User
  },

  async setUserRole (id: string, role: UserRole): Promise<boolean> {
    const db = await getDb()
    const result = await col(db, 'users').updateOne({ _id: id }, { $set: { role } })
    return result.matchedCount > 0
  },

  async getUserCount (): Promise<number> {
    const db = await getDb()
    return await col(db, 'users').countDocuments()
  },
}

// ========== Full store export/import ==========

export async function getStore (): Promise<StoreSnapshot> {
  const db = await getDb()
  const allComments = (await col(db, 'comments').find({}).toArray()).map(r => normalizeDoc(r) as Comment)
  const allConfigs = await col(db, 'configs').find({}).toArray()
  const allVisitors = await col(db, 'visitors').find({}).toArray()
  const allSessions = await col(db, 'sessions').find({}).toArray()

  const store: StoreSnapshot = {
    comments: allComments,
    configs: {},
    visitors: {},
    sessions: allSessions.map(s => ({ token: s._id, createdAt: toMs(s.createdAt) })),
    reactions: {},
    commentReactions: {},
  }
  for (const c of allConfigs) store.configs[c._id] = { value: c.value, updatedAt: c.updatedAt }
  for (const v of allVisitors) store.visitors[v._id] = { title: v.title, count: v.count, updatedAt: v.updatedAt }

  const allReactions = await col(db, 'reactions').find({}).toArray()
  const reactMap: Record<string, ReactionMap> = {}
  for (const r of allReactions) {
    if (!reactMap[r.url]) reactMap[r.url] = {}
    if (!reactMap[r.url][r.emoji]) reactMap[r.url][r.emoji] = []
    reactMap[r.url][r.emoji].push(r.ip)
  }
  store.reactions = reactMap

  const allCommentReactions = await col(db, 'comment_reactions').find({}).toArray()
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
  const db = await getDb()
  // 批量 bulkWrite，ordered:false 允许并行执行，大幅提升导入速度
  if (data.comments) {
    const ops = data.comments.map((c: Comment) => ({
      replaceOne: {
        filter: { _id: c.id },
        replacement: {
          _id: c.id,
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
          isSpam: !!c.isSpam,
          isTop: !!c.isTop,
          isPinned: !!c.isPinned,
          isPrivate: !!c.isPrivate,
          image: c.image,
          sticker: c.sticker,
          ipRegion: c.ipRegion,
          tags: c.tags,
          renderedComment: c.renderedComment || null,
        },
        upsert: true,
      },
    }))
    if (ops.length > 0) await col(db, 'comments').bulkWrite(ops, { ordered: false })
  }
  if (data.configs) {
    const ops = (Object.entries(data.configs)).map(([key, val]) => ({
      replaceOne: {
        filter: { _id: key },
        replacement: { _id: key, value: val.value, updatedAt: val.updatedAt || Date.now() },
        upsert: true,
      },
    }))
    if (ops.length > 0) await col(db, 'configs').bulkWrite(ops, { ordered: false })
  }
  if (data.visitors) {
    const ops = (Object.entries(data.visitors)).map(([url, v]) => ({
      replaceOne: {
        filter: { _id: url },
        replacement: { _id: url, title: v.title, count: v.count, updatedAt: v.updatedAt },
        upsert: true,
      },
    }))
    if (ops.length > 0) await col(db, 'visitors').bulkWrite(ops, { ordered: false })
  }
  if (data.reactions) {
    const ops: any[] = []
    for (const [url, emojis] of Object.entries(data.reactions)) {
      for (const [emoji, ips] of Object.entries(emojis)) {
        for (const ip of ips) {
          ops.push({ replaceOne: { filter: { url, emoji, ip }, replacement: { url, emoji, ip }, upsert: true } })
        }
      }
    }
    if (ops.length > 0) await col(db, 'reactions').bulkWrite(ops, { ordered: false })
  }
  if (data.commentReactions) {
    const ops: any[] = []
    for (const [commentId, emojis] of Object.entries(data.commentReactions)) {
      for (const [emoji, ips] of Object.entries(emojis)) {
        for (const ip of ips) {
          ops.push({ replaceOne: { filter: { commentId, ip }, replacement: { commentId, emoji, ip, createdAt: Date.now() }, upsert: true } })
        }
      }
    }
    if (ops.length > 0) await col(db, 'comment_reactions').bulkWrite(ops, { ordered: false })
  }
}

export async function ensureDb (): Promise<void> {
  const db = await getDb()
  await col(db, 'comments').createIndexes([
    { key: { url: 1 } },
    { key: { pid: 1 } },
    { key: { created: -1 } },
    { key: { state: 1 } },
    // 复合索引：加速评论列表主查询
    { key: { url: 1, state: 1, created: -1 } },
    { key: { isSpam: 1 } },
  ])
  // TTL index: MongoDB auto-deletes sessions 24h after createdAt.
  // Essential for serverless where no app-level cleanup timer runs.
  await col(db, 'sessions').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 86400 }
  )
  await col(db, 'reactions').createIndex({ url: 1 })
  // Comment reactions: unique (commentId, ip) enforces one reaction per visitor per comment
  await col(db, 'comment_reactions').createIndex({ commentId: 1, ip: 1 }, { unique: true })
  await col(db, 'comment_reactions').createIndex({ commentId: 1 })

  // Users collection indexes
  await col(db, 'users').createIndexes([
    { key: { email: 1 } },
    { key: { provider: 1, providerId: 1 } },
  ])
}

// ========== DB-based Rate Limiting (MongoDB) ==========

export async function dbRateLimit (
  key: string,
  maxRequests: number,
  _windowMs: number,
  windowStart: number
): Promise<boolean> {
  if (maxRequests <= 0) return false
  const db = await getDb()
  const rateCol = col(db, 'rate_limits')

  // 原子化 findOneAndUpdate + upsert + $inc：MongoDB 在文档级别保证原子性
  const result = await rateCol.findOneAndUpdate(
    { key, windowStart },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  return (result?.count ?? 0) <= maxRequests
}
