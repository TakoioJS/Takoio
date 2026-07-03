/**
 * Migrations — columnMigrations 结构验证测试
 *
 * 验证 src/server/core/db/migrations.ts 导出的 columnMigrations 数组：
 * - 5 项完整
 * - 每项字段合法（name、column、sql）
 * - name 符合命名规范（add_comments_*）
 * - column 字段名与 sql 中 ALTER TABLE 语句的列名一致
 * - sql 包含 "ALTER TABLE comments ADD COLUMN"
 *
 * 注意：实际实现使用单一 `sql` 字段（dialect-agnostic），而非 spec 任务描述中
 * 提及的 `sqliteSql`/`pgSql` 分离字段。这是因为 SQLite 与 PostgreSQL 的
 * ALTER TABLE ADD COLUMN 语法在此场景下完全一致（详见 migrations.ts 头部注释）。
 */

import { describe, it, expect } from 'vitest'
import { columnMigrations } from '../migrations'

describe('columnMigrations', () => {
  it('contains exactly 5 migration entries', () => {
    expect(columnMigrations).toHaveLength(5)
  })

  it('each entry has required fields: name, column, sql', () => {
    for (const m of columnMigrations) {
      expect(m).toHaveProperty('name')
      expect(m).toHaveProperty('column')
      expect(m).toHaveProperty('sql')
      expect(typeof m.name).toBe('string')
      expect(typeof m.column).toBe('string')
      expect(typeof m.sql).toBe('string')
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.column.length).toBeGreaterThan(0)
      expect(m.sql.length).toBeGreaterThan(0)
    }
  })

  it('names follow the add_comments_* naming convention', () => {
    for (const m of columnMigrations) {
      expect(m.name).toMatch(/^add_comments_[a-z_]+$/)
    }
  })

  it('column name matches the column in the ALTER TABLE statement', () => {
    for (const m of columnMigrations) {
      // Extract column name from: ALTER TABLE comments ADD COLUMN <column> TEXT
      const match = m.sql.match(/ADD\s+COLUMN\s+(\w+)/i)
      expect(match).not.toBeNull()
      expect(match![1]).toBe(m.column)
    }
  })

  it('all sql fields contain "ALTER TABLE comments ADD COLUMN"', () => {
    for (const m of columnMigrations) {
      expect(m.sql).toContain('ALTER TABLE comments ADD COLUMN')
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

  it('contains the 5 expected migrations', () => {
    const names = columnMigrations.map(m => m.name)
    expect(names).toContain('add_comments_image')
    expect(names).toContain('add_comments_sticker')
    expect(names).toContain('add_comments_ip_region')
    expect(names).toContain('add_comments_tags')
    expect(names).toContain('add_comments_rendered')
  })

  it('all sql statements end with TEXT type', () => {
    for (const m of columnMigrations) {
      expect(m.sql).toMatch(/TEXT$/)
    }
  })

  it('image migration adds image column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_image')
    expect(m).toBeDefined()
    expect(m!.column).toBe('image')
    expect(m!.sql).toBe('ALTER TABLE comments ADD COLUMN image TEXT')
  })

  it('sticker migration adds sticker column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_sticker')
    expect(m).toBeDefined()
    expect(m!.column).toBe('sticker')
    expect(m!.sql).toBe('ALTER TABLE comments ADD COLUMN sticker TEXT')
  })

  it('ip_region migration adds ip_region column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_ip_region')
    expect(m).toBeDefined()
    expect(m!.column).toBe('ip_region')
    expect(m!.sql).toBe('ALTER TABLE comments ADD COLUMN ip_region TEXT')
  })

  it('tags migration adds tags column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_tags')
    expect(m).toBeDefined()
    expect(m!.column).toBe('tags')
    expect(m!.sql).toBe('ALTER TABLE comments ADD COLUMN tags TEXT')
  })

  it('rendered migration adds rendered_comment column', () => {
    const m = columnMigrations.find(m => m.name === 'add_comments_rendered')
    expect(m).toBeDefined()
    expect(m!.column).toBe('rendered_comment')
    expect(m!.sql).toBe('ALTER TABLE comments ADD COLUMN rendered_comment TEXT')
  })
})
