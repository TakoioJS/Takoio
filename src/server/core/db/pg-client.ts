import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import * as schema from './schema-pg'
import { columnMigrations } from './migrations'

export type PgDbClient = ReturnType<typeof drizzle<typeof schema>>
export type PgRawClient = ReturnType<typeof postgres>

let _db: PgDbClient | null = null
let _raw: PgRawClient | null = null

function getConnectionUrl (): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!url) throw new Error('PostgreSQL: 缺少 POSTGRES_URL 或 DATABASE_URL 环境变量')
  return url
}

export function getDb (): PgDbClient {
  if (_db) return _db
  const url = getConnectionUrl()
  // postgres-js: 单例连接池；max 控制并发数
  _raw = postgres(url, { max: 10, prepare: false })
  _db = drizzle(_raw, { schema })
  return _db
}

export async function initDb (): Promise<void> {
  if (!_raw) return
  const db = getDb()

  // CREATE TABLE IF NOT EXISTS — PG 语法
  await db.execute(sql`CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    href TEXT,
    nick TEXT NOT NULL,
    mail TEXT,
    mail_md5 TEXT,
    link TEXT,
    comment TEXT NOT NULL,
    ua TEXT,
    ip TEXT,
    state TEXT NOT NULL DEFAULT 'visible',
    created INTEGER NOT NULL,
    updated INTEGER,
    pid TEXT,
    rid TEXT,
    "like" INTEGER NOT NULL DEFAULT 0,
    dislike INTEGER NOT NULL DEFAULT 0,
    is_spam BOOLEAN NOT NULL DEFAULT FALSE,
    is_top BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    user_id TEXT,
    auth_provider TEXT,
    image TEXT,
    sticker TEXT,
    ip_region TEXT,
    tags TEXT,
    rendered_comment TEXT
  )`)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_pid ON comments(pid)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_state ON comments(state)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_url_state_created ON comments(url, state, created)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_is_spam ON comments(is_spam)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comments_is_private ON comments(is_private)`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS visitors (
    url TEXT PRIMARY KEY,
    title TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  )`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS reactions (
    url TEXT NOT NULL,
    emoji TEXT NOT NULL,
    ip TEXT NOT NULL,
    PRIMARY KEY (url, emoji, ip)
  )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reactions_url ON reactions(url)`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (comment_id, ip)
  )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_comment_reactions_commentId ON comment_reactions(comment_id)`)

  // Users table
  await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL,
    login_count INTEGER NOT NULL DEFAULT 1
  )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id)`)

  // Migration tracking table
  await db.execute(sql`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`)

  // Column migrations — PG 用 information_schema 检查列是否存在
  // drizzle-orm/postgres-js 的 db.execute() 直接返回 RowList（数组），无 .rows 属性
  const applied = await db.execute(sql`SELECT name FROM migrations`)
  const appliedNames = new Set((applied as unknown as Array<{ name: string }>).map(r => r.name))

  const existingColumns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'comments'
  `)
  const existingColumnNames = new Set((existingColumns as unknown as Array<{ column_name: string }>).map(r => r.column_name))

  for (const m of columnMigrations) {
    if (!appliedNames.has(m.name)) {
      if (!existingColumnNames.has(m.column)) {
        const migrationSql = m.pgSql ?? m.sql
        if (migrationSql) await db.execute(sql.raw(migrationSql))
      }
      await db.execute(sql`INSERT INTO migrations (name, applied_at) VALUES (${m.name}, ${Date.now()})`)
    }
  }
}

export async function closeDb (): Promise<void> {
  _db = null
  if (_raw) { await _raw.end(); _raw = null }
}
