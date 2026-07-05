/**
 * 列迁移清单 — SQLite 与 PostgreSQL 共享。
 *
 * 早期迁移（image/sticker/ip_region/tags/rendered_comment）的列类型在两方言
 * 下均为 TEXT，SQL 完全一致，使用单一 `sql` 字段即可。
 *
 * `is_private` 在两方言下类型不同：
 * - SQLite: `INTEGER NOT NULL DEFAULT 0`
 * - PostgreSQL: `BOOLEAN NOT NULL DEFAULT FALSE`
 * 因此需要分别提供 `sqliteSql` 与 `pgSql`。
 *
 * 调用方：
 * - SQLite (client.ts)：使用 `m.sqliteSql ?? m.sql`
 * - PostgreSQL (pg-client.ts)：使用 `m.pgSql ?? m.sql`
 */

export interface ColumnMigration {
  /** 迁移名称（写入 migrations 表用于幂等性追踪） */
  name: string
  /** 列名（用于 information_schema / PRAGMA table_info 检查列是否已存在） */
  column: string
  /** dialect-agnostic SQL（可选；当 sqliteSql/pgSql 未提供时使用） */
  sql?: string
  /** SQLite 专用 SQL（覆盖 sql） */
  sqliteSql?: string
  /** PostgreSQL 专用 SQL（覆盖 sql） */
  pgSql?: string
}

export const columnMigrations: ColumnMigration[] = [
  // v1.0 — ensure optional columns exist for databases created before they were added
  { name: 'add_comments_image', column: 'image', sql: 'ALTER TABLE comments ADD COLUMN image TEXT' },
  { name: 'add_comments_sticker', column: 'sticker', sql: 'ALTER TABLE comments ADD COLUMN sticker TEXT' },
  { name: 'add_comments_ip_region', column: 'ip_region', sql: 'ALTER TABLE comments ADD COLUMN ip_region TEXT' },
  { name: 'add_comments_tags', column: 'tags', sql: 'ALTER TABLE comments ADD COLUMN tags TEXT' },
  { name: 'add_comments_rendered', column: 'rendered_comment', sql: 'ALTER TABLE comments ADD COLUMN rendered_comment TEXT' },
  // 私密评论：仅博主与作者本人可见
  {
    name: 'add_comments_is_private',
    column: 'is_private',
    sqliteSql: 'ALTER TABLE comments ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0',
    pgSql: 'ALTER TABLE comments ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE',
  },
  // 用户关联：登录用户提交评论时写入 userId
  { name: 'add_comments_user_id', column: 'user_id', sql: 'ALTER TABLE comments ADD COLUMN user_id TEXT' },
  // 登录 provider 冗余（github/google/email），用于显示标识
  { name: 'add_comments_auth_provider', column: 'auth_provider', sql: 'ALTER TABLE comments ADD COLUMN auth_provider TEXT' },
]
