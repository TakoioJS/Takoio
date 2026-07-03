/**
 * 列迁移清单 — SQLite 与 PostgreSQL 共享。
 *
 * 这 5 项 ALTER TABLE ... ADD COLUMN 语句在两个方言下语法完全一致
 * （均为 `ALTER TABLE comments ADD COLUMN <column> TEXT`），因此只存一份纯字符串：
 * - SQLite (client.ts)：直接传给 `_raw.execute(string)`
 * - PostgreSQL (pg-client.ts)：用 `sql.raw(string)` 包装后传给 `db.execute()`
 *
 * `sql.raw` 不接受参数插值，但本清单的 SQL 全部为静态字符串（列名与类型硬编码），
 * 无注入风险，因此可安全使用。
 */

export interface ColumnMigration {
  /** 迁移名称（写入 migrations 表用于幂等性追踪） */
  name: string
  /** 列名（用于 information_schema / PRAGMA table_info 检查列是否已存在） */
  column: string
  /** ALTER TABLE SQL 字符串（dialect-agnostic，sqlite 与 pg 均适用） */
  sql: string
}

export const columnMigrations: ColumnMigration[] = [
  // v1.0 — ensure optional columns exist for databases created before they were added
  { name: 'add_comments_image', column: 'image', sql: 'ALTER TABLE comments ADD COLUMN image TEXT' },
  { name: 'add_comments_sticker', column: 'sticker', sql: 'ALTER TABLE comments ADD COLUMN sticker TEXT' },
  { name: 'add_comments_ip_region', column: 'ip_region', sql: 'ALTER TABLE comments ADD COLUMN ip_region TEXT' },
  { name: 'add_comments_tags', column: 'tags', sql: 'ALTER TABLE comments ADD COLUMN tags TEXT' },
  { name: 'add_comments_rendered', column: 'rendered_comment', sql: 'ALTER TABLE comments ADD COLUMN rendered_comment TEXT' },
]
