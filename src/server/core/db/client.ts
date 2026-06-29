import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'

export type DbClient = ReturnType<typeof drizzle<typeof schema>>
export type RawClient = ReturnType<typeof createClient>

let _db: DbClient | null = null
let _raw: RawClient | null = null

/** Resolve the SQLite DB path relative to src/server/ (project root for the server) */
function getDefaultDbPath (): string {
  // LIBSQL_DATA_DIR overrides the default directory (useful for production builds)
  const dataDir = process.env.LIBSQL_DATA_DIR || resolve(process.cwd(), 'data')
  return `file:${resolve(dataDir, 'takoio.db')}`
}

function getUrl () {
  return process.env.LIBSQL_URL || process.env.TURSO_DB_URL || getDefaultDbPath()
}

function getAuthToken () {
  return process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_DB_TOKEN
}

export function getDb (): DbClient {
  if (_db) return _db
  const url = getUrl()
  const authToken = getAuthToken()
  _raw = createClient(authToken ? { url, authToken } : { url })
  _db = drizzle(_raw, { schema })
  return _db
}

export async function initDb () {
  const db = getDb()
  if (!_raw) return

  // Enable foreign key constraint enforcement
  await _raw.execute('PRAGMA foreign_keys = ON')

  await _raw.execute(`CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY, url TEXT NOT NULL, href TEXT,
    nick TEXT NOT NULL, mail TEXT, mail_md5 TEXT, link TEXT,
    comment TEXT NOT NULL, ua TEXT, ip TEXT,
    state TEXT NOT NULL DEFAULT 'visible',
    created INTEGER NOT NULL, updated INTEGER,
    pid TEXT, rid TEXT,
    "like" INTEGER NOT NULL DEFAULT 0,
    dislike INTEGER NOT NULL DEFAULT 0,
    is_spam INTEGER NOT NULL DEFAULT 0,
    is_top INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    image TEXT, sticker TEXT, ip_region TEXT, tags TEXT, rendered_comment TEXT
  )`)
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)')
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_comments_pid ON comments(pid)')
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created)')
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_comments_state ON comments(state)')

  await _raw.execute(`CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
  )`)

  await _raw.execute(`CREATE TABLE IF NOT EXISTS visitors (
    url TEXT PRIMARY KEY, title TEXT, count INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
  )`)

  await _raw.execute(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, created_at INTEGER NOT NULL
  )`)

  await _raw.execute(`CREATE TABLE IF NOT EXISTS reactions (
    url TEXT NOT NULL, emoji TEXT NOT NULL, ip TEXT NOT NULL,
    PRIMARY KEY (url, emoji, ip)
  )`)
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_reactions_url ON reactions(url)')

  await _raw.execute(`CREATE TABLE IF NOT EXISTS comment_reactions (
    comment_id TEXT NOT NULL, emoji TEXT NOT NULL, ip TEXT NOT NULL, created_at INTEGER,
    PRIMARY KEY (comment_id, ip)
  )`)
  await _raw.execute('CREATE INDEX IF NOT EXISTS idx_comment_reactions_commentId ON comment_reactions(comment_id)')

  // Migration tracking table
  await _raw.execute(`CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL
  )`)

  // Run pending column migrations
  // Use PRAGMA table_info to check existing columns — avoids "duplicate column" errors
  // when the DB was created from a newer CREATE TABLE but migrations table has no records.
  const applied = await _raw.execute('SELECT name FROM migrations')
  const appliedNames = new Set(applied.rows.map((r: any) => r.name))

  const existingColumns = await _raw.execute('PRAGMA table_info(comments)')
  const existingColumnNames = new Set(existingColumns.rows.map((r: any) => r.name))

  const columnMigrations: [string, string, string][] = [
    // v1.0 — ensure optional columns exist for databases created before they were added
    ['add_comments_image', 'image', 'ALTER TABLE comments ADD COLUMN image TEXT'],
    ['add_comments_sticker', 'sticker', 'ALTER TABLE comments ADD COLUMN sticker TEXT'],
    ['add_comments_ip_region', 'ip_region', 'ALTER TABLE comments ADD COLUMN ip_region TEXT'],
    ['add_comments_tags', 'tags', 'ALTER TABLE comments ADD COLUMN tags TEXT'],
    ['add_comments_rendered', 'rendered_comment', 'ALTER TABLE comments ADD COLUMN rendered_comment TEXT'],
  ]

  for (const [name, column, sql] of columnMigrations) {
    if (!appliedNames.has(name)) {
      if (!existingColumnNames.has(column)) {
        await _raw.execute(sql)
      }
      await _raw.execute({ sql: 'INSERT INTO migrations (name, applied_at) VALUES (?, ?)', args: [name, Date.now()] })
    }
  }
}

export async function closeDb () {
  _db = null
  if (_raw) { _raw.close(); _raw = null }
}
