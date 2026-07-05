/**
 * Schema 共享定义 — sqlite 与 pg 的表结构在一份文件内并排维护，
 * 由 `defineSchema(dialect)` 工厂按方言返回对应 schema 对象。
 *
 * 设计决策：
 * - 不引入第二层抽象（无 SchemaBuilder / 无 config-driven 字段生成器）
 * - sqlite 与 pg 的表定义各自完整写出（仅 isSpam/isTop/isPinned 三字段有 integer vs boolean 差异），
 *   两份定义并排放置使结构差异最小化、可视化对照
 * - `defineSchema` 用泛型 + 条件返回类型保留具体类型，避免返回联合类型导致下游
 *   drizzle 查询方法签名断裂（spec 风险点 1 的缓解措施；不用 overload 以避开 ESLint
 *   `no-redeclare` 误报）
 */

import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { pgTable, text as pgText, integer as pgInteger, boolean, index as pgIndex, primaryKey as pgPrimaryKey } from 'drizzle-orm/pg-core'

/** sqlite users 表 — 独立构造便于独立管理 */
function _buildSqliteUsers () {
  return sqliteTable('users', {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    providerId: text('provider_id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatar: text('avatar'),
    role: text('role').notNull().default('user'),
    createdAt: integer('created_at').notNull(),
    lastLoginAt: integer('last_login_at').notNull(),
    loginCount: integer('login_count').notNull().default(1),
  }, (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_provider').on(table.provider, table.providerId),
  ])
}

/** pg users 表 */
function _buildPgUsers () {
  return pgTable('users', {
    id: pgText('id').primaryKey(),
    provider: pgText('provider').notNull(),
    providerId: pgText('provider_id').notNull(),
    email: pgText('email').notNull(),
    name: pgText('name').notNull(),
    avatar: pgText('avatar'),
    role: pgText('role').notNull().default('user'),
    createdAt: pgInteger('created_at').notNull(),
    lastLoginAt: pgInteger('last_login_at').notNull(),
    loginCount: pgInteger('login_count').notNull().default(1),
  }, (table) => [
    pgIndex('idx_users_email').on(table.email),
    pgIndex('idx_users_provider').on(table.provider, table.providerId),
  ])
}

/** sqlite schema 内部构造（用于 ReturnType 推导） */
function _buildSqliteSchema () {
  const comments = sqliteTable('comments', {
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
    isSpam: integer('is_spam').notNull().default(0),
    isTop: integer('is_top').notNull().default(0),
    isPinned: integer('is_pinned').notNull().default(0),
    isPrivate: integer('is_private').notNull().default(0), // 私密评论：仅博主与作者可见
    userId: text('user_id'), // 登录用户关联
    authProvider: text('auth_provider'), // 登录 provider 冗余
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
    index('idx_comments_is_private').on(table.isPrivate),
  ])

  const configs = sqliteTable('configs', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at').notNull(),
  })

  const visitors = sqliteTable('visitors', {
    url: text('url').primaryKey(),
    title: text('title'),
    count: integer('count').notNull().default(1),
    updatedAt: integer('updated_at').notNull(),
  })

  const sessions = sqliteTable('sessions', {
    token: text('token').primaryKey(),
    createdAt: integer('created_at').notNull(),
  })

  const rateLimits = sqliteTable('rate_limits', {
    key: text('key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
  }, (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index('idx_rate_limits_key').on(table.key),
  ])

  const reactions = sqliteTable('reactions', {
    url: text('url').notNull(),
    emoji: text('emoji').notNull(),
    ip: text('ip').notNull(),
  }, (table) => [
    primaryKey({ columns: [table.url, table.emoji, table.ip] }),
    index('idx_reactions_url').on(table.url),
  ])

  const commentReactions = sqliteTable('comment_reactions', {
    commentId: text('comment_id').notNull(),
    emoji: text('emoji').notNull(),
    ip: text('ip').notNull(),
    createdAt: integer('created_at'),
  }, (table) => [
    primaryKey({ columns: [table.commentId, table.ip] }),
    index('idx_comment_reactions_commentId').on(table.commentId),
  ])

  return { comments, configs, visitors, sessions, rateLimits, reactions, commentReactions, users: _buildSqliteUsers() }
}

/** pg schema 内部构造（用于 ReturnType 推导） */
function _buildPgSchema () {
  const comments = pgTable('comments', {
    id: pgText('id').primaryKey(),
    url: pgText('url').notNull(),
    href: pgText('href'),
    nick: pgText('nick').notNull(),
    mail: pgText('mail'),
    mailMd5: pgText('mail_md5'),
    link: pgText('link'),
    comment: pgText('comment').notNull(),
    ua: pgText('ua'),
    ip: pgText('ip'),
    state: pgText('state').notNull().default('visible'),
    created: pgInteger('created').notNull(),
    updated: pgInteger('updated'),
    pid: pgText('pid'),
    rid: pgText('rid'),
    like: pgInteger('like').notNull().default(0),
    dislike: pgInteger('dislike').notNull().default(0),
    // PG 原生 boolean，无需 0/1 转换
    isSpam: boolean('is_spam').notNull().default(false),
    isTop: boolean('is_top').notNull().default(false),
    isPinned: boolean('is_pinned').notNull().default(false),
    isPrivate: boolean('is_private').notNull().default(false), // 私密评论：仅博主与作者可见
    userId: pgText('user_id'), // 登录用户关联
    authProvider: pgText('auth_provider'), // 登录 provider 冗余
    image: pgText('image'),
    sticker: pgText('sticker'),
    ipRegion: pgText('ip_region'),
    tags: pgText('tags'),
    renderedComment: pgText('rendered_comment'),
  }, (table) => [
    pgIndex('idx_comments_url').on(table.url),
    pgIndex('idx_comments_pid').on(table.pid),
    pgIndex('idx_comments_created').on(table.created),
    pgIndex('idx_comments_state').on(table.state),
    // 复合索引：评论列表主查询 WHERE url=? AND state IN(...) AND pid IS NULL ORDER BY created
    pgIndex('idx_comments_url_state_created').on(table.url, table.state, table.created),
    pgIndex('idx_comments_is_spam').on(table.isSpam),
    pgIndex('idx_comments_is_private').on(table.isPrivate),
  ])

  const configs = pgTable('configs', {
    key: pgText('key').primaryKey(),
    value: pgText('value').notNull(),
    updatedAt: pgInteger('updated_at').notNull(),
  })

  const visitors = pgTable('visitors', {
    url: pgText('url').primaryKey(),
    title: pgText('title'),
    count: pgInteger('count').notNull().default(1),
    updatedAt: pgInteger('updated_at').notNull(),
  })

  const sessions = pgTable('sessions', {
    token: pgText('token').primaryKey(),
    createdAt: pgInteger('created_at').notNull(),
  })

  const rateLimits = pgTable('rate_limits', {
    key: pgText('key').notNull(),
    windowStart: pgInteger('window_start').notNull(),
    count: pgInteger('count').notNull().default(0),
  }, (table) => [
    pgPrimaryKey({ columns: [table.key, table.windowStart] }),
    pgIndex('idx_rate_limits_key').on(table.key),
  ])

  const reactions = pgTable('reactions', {
    url: pgText('url').notNull(),
    emoji: pgText('emoji').notNull(),
    ip: pgText('ip').notNull(),
  }, (table) => [
    pgPrimaryKey({ columns: [table.url, table.emoji, table.ip] }),
    pgIndex('idx_reactions_url').on(table.url),
  ])

  const commentReactions = pgTable('comment_reactions', {
    commentId: pgText('comment_id').notNull(),
    emoji: pgText('emoji').notNull(),
    ip: pgText('ip').notNull(),
    createdAt: pgInteger('created_at'),
  }, (table) => [
    pgPrimaryKey({ columns: [table.commentId, table.ip] }),
    pgIndex('idx_comment_reactions_commentId').on(table.commentId),
  ])

  return { comments, configs, visitors, sessions, rateLimits, reactions, commentReactions, users: _buildPgUsers() }
}

type SqliteSchema = ReturnType<typeof _buildSqliteSchema>
type PgSchema = ReturnType<typeof _buildPgSchema>

/**
 * 按 dialect 返回对应方言的 schema 对象（含 7 张表）。
 *
 * 调用方：schema.ts 传 'sqlite'，schema-pg.ts 传 'pg'。
 * 用泛型 + 条件返回类型保留具体方言的表类型，避免联合类型断裂下游 drizzle 查询签名
 * （spec 风险点 1 的缓解措施；改用条件类型而非 overload 以避开 ESLint `no-redeclare` 误报）。
 */
type SchemaFor<D extends 'sqlite' | 'pg'> = D extends 'sqlite' ? SqliteSchema : PgSchema

export function defineSchema<D extends 'sqlite' | 'pg'> (dialect: D): SchemaFor<D> {
  if (dialect === 'sqlite') return _buildSqliteSchema() as SchemaFor<D>
  return _buildPgSchema() as SchemaFor<D>
}
