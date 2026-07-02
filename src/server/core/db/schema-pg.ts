import { pgTable, text, integer, boolean, index, primaryKey } from 'drizzle-orm/pg-core'

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  href: text('href'),
  nick: text('nick').notNull(),
  mail: text('mail'),
  mailMd5: text('mail_md5'),
  link: text('link'),
  comment: text('comment').notNull(),
  ua: text('ua'),
  ip: text('ip'),
  state: text('state').notNull().default('visible'),
  created: integer('created').notNull(),
  updated: integer('updated'),
  pid: text('pid'),
  rid: text('rid'),
  like: integer('like').notNull().default(0),
  dislike: integer('dislike').notNull().default(0),
  // PG 原生 boolean，无需 0/1 转换
  isSpam: boolean('is_spam').notNull().default(false),
  isTop: boolean('is_top').notNull().default(false),
  isPinned: boolean('is_pinned').notNull().default(false),
  image: text('image'),
  sticker: text('sticker'),
  ipRegion: text('ip_region'),
  tags: text('tags'),
  renderedComment: text('rendered_comment'),
}, (table) => [
  index('idx_comments_url').on(table.url),
  index('idx_comments_pid').on(table.pid),
  index('idx_comments_created').on(table.created),
  index('idx_comments_state').on(table.state),
  // 复合索引：评论列表主查询 WHERE url=? AND state IN(...) AND pid IS NULL ORDER BY created
  index('idx_comments_url_state_created').on(table.url, table.state, table.created),
  index('idx_comments_is_spam').on(table.isSpam),
])

export const configs = pgTable('configs', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const visitors = pgTable('visitors', {
  url: text('url').primaryKey(),
  title: text('title'),
  count: integer('count').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  createdAt: integer('created_at').notNull(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').notNull(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.key, table.windowStart] }),
  index('idx_rate_limits_key').on(table.key),
])

export const reactions = pgTable('reactions', {
  url: text('url').notNull(),
  emoji: text('emoji').notNull(),
  ip: text('ip').notNull(),
}, (table) => [
  primaryKey({ columns: [table.url, table.emoji, table.ip] }),
  index('idx_reactions_url').on(table.url),
])

export const commentReactions = pgTable('comment_reactions', {
  commentId: text('comment_id').notNull(),
  emoji: text('emoji').notNull(),
  ip: text('ip').notNull(),
  createdAt: integer('created_at'),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.ip] }),
  index('idx_comment_reactions_commentId').on(table.commentId),
])
