import { MongoClient, type Db, type Collection } from 'mongodb'
import { randomUUID } from 'node:crypto'

type Col = Collection<any>

const col = (db: Db, name: string): Col => db.collection<any>(name)

export const COMMENT_STATE = {
  VISIBLE: 'visible', HIDDEN: 'hidden', SPAM: 'spam', PENDING: 'pending',
} as const

let _client: MongoClient | null = null
let _db: Db | null = null

const connUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = () => process.env.MONGODB_DB || 'takoio'

async function getDb(): Promise<Db> {
  if (_db) return _db
  _client = new MongoClient(connUri())
  await _client.connect()
  _db = _client.db(dbName())
  return _db
}

const relTime = (ts: number): string => {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return new Date(ts).toLocaleDateString()
}

const stripPrivate = (r: any) => {
  if (!r) return r
  const { ip, mail, ...rest } = r
  return { ...rest, relativeTime: relTime(rest.created) }
}

const normalizeDoc = (r: any) => {
  if (!r) return r
  const { _id, ...rest } = r
  return { id: _id, ...rest, like: r.like ?? 0, dislike: r.dislike ?? 0 }
}

export const commentStore = {
  async addComment (data: any) {
    const db = await getDb()
    await col(db, 'comments').insertOne({
      _id: data.id, url: data.url, href: data.href, nick: data.nick,
      mail: data.mail, mailMd5: data.mailMd5, link: data.link,
      comment: data.comment, ua: data.ua, ip: data.ip,
      state: data.state || 'visible', created: data.created,
      updated: data.updated, pid: data.pid, rid: data.rid,
      like: data.like ?? 0, dislike: data.dislike ?? 0,
      isSpam: !!data.isSpam, isTop: !!data.isTop, isPinned: !!data.isPinned,
      image: data.image, sticker: data.sticker, ipRegion: data.ipRegion, tags: data.tags,
      renderedComment: data.renderedComment || null,
    })
    return { ...data, relativeTime: relTime(data.created), children: [], replyCount: 0 }
  },

  async getComment (id: string) {
    const db = await getDb()
    const doc = await col(db, 'comments').findOne({ _id: id })
    return doc ? normalizeDoc(doc) : undefined
  },

  async updateComment (id: string, data: any) {
    const db = await getDb()
    const set: any = { ...data, updated: Date.now() }
    if ('isSpam' in set) set.isSpam = !!set.isSpam
    if ('isTop' in set) set.isTop = !!set.isTop
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: set })
    return result.matchedCount > 0
  },

  async getComments (url: string, page = 1, pageSize = 10, sort = 'newest') {
    const db = await getDb()
    const visibleStates = ['visible', 'pending']
    const sortOrder: Record<string, 1 | -1> = sort === 'oldest' ? { created: 1 }
      : sort === 'hottest' ? { like: -1 }
      : { created: -1 }
    const query = { url, state: { $in: visibleStates }, pid: null }

    const total = await col(db, 'comments').countDocuments(query)
    const rows = await col(db, 'comments').find(query)
      .sort(sortOrder).skip((page - 1) * pageSize).limit(pageSize).toArray()

    const parentIds = rows.map(r => r._id)
    let replyMap = new Map<string, any[]>()
    if (parentIds.length > 0) {
      const allReplies = await col(db, 'comments').find({ pid: { $in: parentIds }, state: { $in: visibleStates } })
        .sort({ created: 1 }).toArray()
      for (const r of allReplies) {
        if (!replyMap.has(r.pid)) replyMap.set(r.pid, [])
        replyMap.get(r.pid)!.push(stripPrivate(normalizeDoc(r)))
      }
    }

    const data = rows.map(c => {
      const children = replyMap.get(c._id) || []
      return { ...stripPrivate(normalizeDoc(c)), children, replyCount: children.length }
    })

    return { data, total }
  },

  async getReplies (pid: string) {
    const db = await getDb()
    const rows = await col(db, 'comments').find({ pid, state: { $in: ['visible', 'pending'] } })
      .sort({ created: 1 }).toArray()
    return rows.map(r => stripPrivate(normalizeDoc(r)))
  },

  async getCommentsCount (urls: string[]) {
    if (urls.length === 0) return []
    const db = await getDb()
    const counts = await col(db, 'comments').aggregate([
      { $match: { url: { $in: urls }, state: 'visible' } },
      { $group: { _id: '$url', count: { $sum: 1 } } },
    ]).toArray()
    const map = new Map(counts.map(c => [c._id, c.count]))
    return urls.map(url => ({ url, count: map.get(url) ?? 0 }))
  },

  async getRecentComments (limit = 10) {
    const db = await getDb()
    const rows = await col(db, 'comments').find({ state: 'visible' })
      .sort({ created: -1 }).limit(limit).toArray()
    return rows.map(r => stripPrivate(normalizeDoc(r)))
  },

  async getRawRecentComments (limit = 50) {
    const db = await getDb()
    const rows = await col(db, 'comments').find({})
      .sort({ created: -1 }).limit(limit).toArray()
    return rows.map(r => normalizeDoc(r))
  },

  async likeComment (id: string) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $inc: { like: 1 } })
    return result.matchedCount > 0
  },

  async dislikeComment (id: string) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $inc: { dislike: 1 } })
    return result.matchedCount > 0
  },

  async setCommentState (id: string, state: string) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { state } })
    return result.matchedCount > 0
  },

  hideComment (id: string) { return commentStore.setCommentState(id, COMMENT_STATE.HIDDEN) },
  showComment (id: string) { return commentStore.setCommentState(id, COMMENT_STATE.VISIBLE) },

  async deleteComment (id: string) {
    const db = await getDb()
    await col(db, 'comments').deleteMany({ $or: [{ _id: id }, { pid: id }] })
    return true
  },

  async setTop (id: string, isTop: boolean) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { isTop } })
    return result.matchedCount > 0
  },

  async setSpam (id: string) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { isSpam: true, state: COMMENT_STATE.SPAM } })
    return result.matchedCount > 0
  },

  async setCommentIpRegion (id: string, ipRegion: string) {
    const db = await getDb()
    const result = await col(db, 'comments').updateOne({ _id: id }, { $set: { ipRegion } })
    return result.matchedCount > 0
  },

  async getAllComments (page = 1, pageSize = 20) {
    const db = await getDb()
    const coll = col(db, 'comments')
    const total = await coll.countDocuments()
    const rows = await coll.find({}).sort({ created: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
    return { data: rows.map(r => normalizeDoc(r)), total }
  },

  async searchComments (page = 1, pageSize = 20, searchStr = '', filter = 'all') {
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
    return { data: rows.map(r => normalizeDoc(r)), total }
  },
}

export const configStore = {
  async getConfig (): Promise<Record<string, any>> {
    const db = await getDb()
    const rows = await col(db, 'configs').find({}).toArray()
    const result: Record<string, any> = {}
    for (const row of rows) {
      try { result[row._id] = JSON.parse(row.value) } catch { result[row._id] = row.value }
    }
    return result
  },

  async setConfig (key: string, value: any) {
    const db = await getDb()
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    await col(db, 'configs').replaceOne(
      { _id: key },
      { _id: key, value: val, updatedAt: Date.now() },
      { upsert: true },
    )
  },

  async setManyConfig (data: Record<string, any>) {
    for (const [key, value] of Object.entries(data)) {
      await configStore.setConfig(key, value)
    }
  },

  async resetConfig () {
    const db = await getDb()
    await col(db, 'configs').deleteMany({})
  },
}

export const visitorStore = {
  async getVisitorCount (url: string, title?: string) {
    const db = await getDb()
    const coll = col(db, 'visitors')
    const existing = await coll.findOne({ _id: url })
    if (!existing) {
      await coll.insertOne({ _id: url, title: title || '', count: 1, updatedAt: Date.now() })
      return { url, time: 1, updatedAt: Date.now() }
    }
    const count = existing.count + 1
    const set: any = { count, updatedAt: Date.now() }
    if (title) set.title = title
    await coll.updateOne({ _id: url }, { $set: set })
    return { url, time: count, updatedAt: Date.now() }
  },
}

export const sessionStore = {
  async createToken () {
    const db = await getDb()
    const token = randomUUID()
    await col(db, 'sessions').insertOne({ _id: token, createdAt: Date.now() })
    return token
  },

  async validateToken (token: string) {
    const db = await getDb()
    const row = await col(db, 'sessions').findOne({ _id: token })
    if (!row) return false
    return Date.now() - row.createdAt < 24 * 60 * 60 * 1000
  },

  async removeToken (token: string) {
    const db = await getDb()
    await col(db, 'sessions').deleteOne({ _id: token })
  },

  async cleanupSessions () {
    const db = await getDb()
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    await col(db, 'sessions').deleteMany({ createdAt: { $lt: dayAgo } })
  },
}

export const reactionStore = {
  async getReactions (url: string) {
    const db = await getDb()
    const rows = await col(db, 'reactions').find({ url }).toArray()
    const result: Record<string, string[]> = {}
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = []
      result[r.emoji].push(r.ip)
    }
    return result
  },

  async toggleReaction (url: string, emoji: string, ip: string) {
    const db = await getDb()
    const coll = col(db, 'reactions')
    const existing = await coll.findOne({ url, emoji, ip })
    if (existing) {
      await coll.deleteOne({ url, emoji, ip })
    } else {
      await coll.insertOne({ url, emoji, ip })
    }
    return reactionStore.getReactions(url)
  },
}

// ========== Full store export/import ==========

export async function getStore () {
  const db = await getDb()
  const allComments = (await col(db, 'comments').find({}).toArray()).map(r => normalizeDoc(r))
  const allConfigs = await col(db, 'configs').find({}).toArray()
  const allVisitors = await col(db, 'visitors').find({}).toArray()
  const allSessions = await col(db, 'sessions').find({}).toArray()

  const store: any = {
    comments: allComments,
    configs: {},
    visitors: {},
    sessions: allSessions,
    reactions: {},
  }
  for (const c of allConfigs) store.configs[c._id] = { value: c.value, updatedAt: c.updatedAt }
  for (const v of allVisitors) store.visitors[v._id] = { title: v.title, count: v.count, updatedAt: v.updatedAt }

  const allReactions = await col(db, 'reactions').find({}).toArray()
  const reactMap: Record<string, Record<string, string[]>> = {}
  for (const r of allReactions) {
    if (!reactMap[r.url]) reactMap[r.url] = {}
    if (!reactMap[r.url][r.emoji]) reactMap[r.url][r.emoji] = []
    reactMap[r.url][r.emoji].push(r.ip)
  }
  store.reactions = reactMap

  return store
}

export async function importStore (data: any) {
  const db = await getDb()
  if (data.comments) {
    const coll = col(db, 'comments')
    for (const c of data.comments) {
      await coll.replaceOne({ _id: c.id }, {
        _id: c.id, url: c.url, href: c.href, nick: c.nick, mail: c.mail,
        mailMd5: c.mailMd5, link: c.link, comment: c.comment, ua: c.ua,
        ip: c.ip, state: c.state || 'visible', created: c.created,
        updated: c.updated, pid: c.pid, rid: c.rid,
        like: c.like ?? 0, dislike: c.dislike ?? 0,
        isSpam: !!c.isSpam, isTop: !!c.isTop, isPinned: !!c.isPinned,
        image: c.image, sticker: c.sticker, ipRegion: c.ipRegion, tags: c.tags,
        renderedComment: c.renderedComment || null,
      }, { upsert: true })
    }
  }
  if (data.configs) {
    const coll = col(db, 'configs')
    for (const [key, val] of Object.entries(data.configs) as [string, any][]) {
      await coll.replaceOne({ _id: key }, { _id: key, value: val.value, updatedAt: val.updatedAt || Date.now() }, { upsert: true })
    }
  }
  if (data.visitors) {
    const coll = col(db, 'visitors')
    for (const [url, v] of Object.entries(data.visitors) as [string, any][]) {
      await coll.replaceOne({ _id: url }, { _id: url, title: v.title, count: v.count, updatedAt: v.updatedAt }, { upsert: true })
    }
  }
  if (data.reactions) {
    const coll = col(db, 'reactions')
    for (const [url, emojis] of Object.entries(data.reactions) as [string, any][]) {
      for (const [emoji, ips] of Object.entries(emojis) as [string, string[]][]) {
        for (const ip of ips) {
          await coll.replaceOne({ url, emoji, ip }, { url, emoji, ip }, { upsert: true })
        }
      }
    }
  }
}

export async function ensureDb () {
  const db = await getDb()
  await col(db, 'comments').createIndexes([
    { key: { url: 1 } },
    { key: { pid: 1 } },
    { key: { created: -1 } },
    { key: { state: 1 } },
  ])
  await col(db, 'sessions').createIndex({ createdAt: 1 })
  await col(db, 'reactions').createIndex({ url: 1 })
}