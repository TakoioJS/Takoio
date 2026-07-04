/**
 * Migrations — columnMigrations 结构验证测试
 *
 * 验证 src/server/core/db/migrations.ts 导出的 columnMigrations 数组：
 * - 每项字段合法（name、column、必有可用的 sql/sqliteSql+pgSql 之一）
 * - name 符合命名规范（add_comments_*）
 * - column 字段名与 sql 中 ALTER TABLE 语句的列名一致
 * - sql 包含 "ALTER TABLE comments ADD COLUMN"
 *
 * 设计变更：ColumnMigration 现在支持 `sql`（dialect-agnostic）与 `sqliteSql/pgSql`
 * 差异化两套 SQL。`is_private` 列在 SQLite 用 INTEGER、PG 用 BOOLEAN，因此拆分。
 * 老条目（image/sticker/ip_region/tags/rendered_comment）继续使用单一 `sql` 字段。
 */

import { describe, it, expect } from 'vitest'
import { columnMigrations } from '../migrations'

function getSqliteSql (m: typeof columnMigrations[number]): string | undefined {
  return m.sqliteSql ?? m.sql
}

function getPgSql (m: typeof columnMigrations[number]): string | undefined {
  return m.pgSql ?? m.sql
}

describe('columnMigrations', () => {
  it('contains the expected migration entries', () => {
    expect(columnMigrations.length).toBeGreaterThanOrEqual(6)
    const names = columnMigrations.map(m => m.name)
    expect(names).toContain('add_comments_image')
    expect(names).toContain('add_comments_sticker')
    expect(names).toContain('add_comments_ip_region')
    expect(names).toContain('add_comments_tags')
    expect(names).toContain('add_comments_rendered')
    expect(names).toContain('add_comments_is_private')
  })

  it('each entry has required fields: name, column, and resolvable SQL for both dialects', () => {
    for (const m of columnMigrations) {
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('column')
      expect(typeof m.name).toBe('string')
      expect(typeof m.column).toBe('string')
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.column.length).toBeGreaterThan(0)
      // 必须能解析出 sqlite 与 pg 两套 SQL
      expect(getSqliteSql(m)).toBeTruthy()
      expect(getPgSql(m)).toBeTruthy()
    }
  })

  it('names follow the add_comments_* naming convention', () => {
    for (const m of columnMigrations) {
      expect(m.name).toMatch(/^add_comments_[a-z_]+$/)
    }
  })

  it('SQLite column name matches the column in the ALTER TABLE statement', () => {
    for (const m of columnMigrations) {
      const sql = getSqliteSql(m)!
      const match = sql.match(/ADD\s+COLUMN\s+(\w+)/i)
      expect(match).not.toBeNull()
      expect(match![1]).toBe(m.column)
    }
  })

  it('PostgreSQL column name matches the column in the ALTER TABLE statement', () => {
    for (const m of columnMigrations) {
      const sql = getPgSql(m)!
      const match = sql.match(/ADD\s+COLUMN\s+(\w+)/i)
      expect(match).not.toBeNull()
      expect(match![1]).toBe(m.column)
    }
  })

  it('all SQLite sql fields contain "ALTER TABLE comments ADD COLUMN"', () => {
    for (const m of columnMigrations) {
      expect(getSqliteSql(m)).toContain('ALTER TABLE comments ADD COLUMN')
    }
  })

  it('all PostgreSQL sql fields contain "ALTER TABLE comments ADD COLUMN"', () => {
    for (const m of columnMigrations) {
      expect(getPgSql(m)).toContain('ALTER TABLE comments ADD COLUMN')
    }
  })

  it('migration names are unique', () => {
    const names = columnMigrations.map(m => m.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('column names are unique', () => {
    const columns = columnMigrations.map(m => m.column)
    expect(new Set(columns).size).toBe(columns.length)
  })

  it('text-type migrations end with TEXT type', () => {
    for (const m of columnMigrations) {
      if (m.name === 'add_comments_is_private') continue
      expect(getSqliteSql(m)).toMatch(/TEXT$/)
      expect(getPgSql(m)).toMatch(/TEXT$/)
    }
  })

  it('is_private migration uses dialect-specific types', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_is_private')!
    expect(m).toBeDefined()
    expect(m.column).toBe('is_private')
    expect(getSqliteSql(m)).toMatch(/INTEGER/)
    expect(getPgSql(m)).toMatch(/BOOLEAN/)
  })

  it('image migration adds image column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_image')!
    expect(m).toBeDefined()
    expect(m.column).toBe('image')
    expect(getSqliteSql(m)).toBe('ALTER TABLE comments ADD COLUMN image TEXT')
  })

  it('sticker migration adds sticker column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_sticker')!
    expect(m).toBeDefined()
    expect(m.column).toBe('sticker')
    expect(getSqliteSql(m)).toBe('ALTER TABLE comments ADD COLUMN sticker TEXT')
  })

  it('ip_region migration adds ip_region column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_ip_region')!
    expect(m).toBeDefined()
    expect(m.column).toBe('ip_region')
    expect(getSqliteSql(m)).toBe('ALTER TABLE comments ADD COLUMN ip_region TEXT')
  })

  it('tags migration adds tags column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_tags')!
    expect(m).toBeDefined()
    expect(m.column).toBe('tags')
    expect(getSqliteSql(m)).toBe('ALTER TABLE comments ADD COLUMN tags TEXT')
  })

  it('rendered migration adds rendered_comment column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_rendered')!
    expect(m).toBeDefined()
    expect(m.column).toBe('rendered_comment')
    expect(getSqliteSql(m)).toBe('ALTER TABLE comments ADD COLUMN rendered_comment TEXT')
  })
})
