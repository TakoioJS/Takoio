/**
 * Store Utils — 纯函数单元测试
 *
 * 测试 src/server/core/store/utils.ts 中导出的所有纯函数：
 * - relTime（相对时间格式化）
 * - stripPrivate（移除私有字段 ip/mail 并附加 relativeTime）
 * - fromRow（SQLite 行 → Comment，0/1 → boolean）
 * - fromRowPg（PG 行 → Comment，原生 boolean）
 * - normalizeDoc（MongoDB doc → Comment，_id → id）
 * - commentToSqliteRow（CommentInput → SQLite 行，boolean → 0/1）
 * - commentToPgRow（CommentInput → PG 行，原生 boolean）
 * - commentToDoc（CommentInput → MongoDB doc，id → _id）
 */

import { describe, it, expect } from 'vitest'
import {
  relTime,
  stripPrivate,
  fromRow,
  fromRowPg,
  normalizeDoc,
  commentToSqliteRow,
  commentToPgRow,
  commentToDoc,
  COMMENT_STATE,
} from '../utils'
import type { Comment } from '../types'

/** 构造一个完整的 Comment 对象用于测试 */
function makeComment (overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'test-id',
    url: '/test',
    href: 'https://example.com/test',
    nick: 'TestUser',
    mail: 'test@example.com',
    mailMd5: 'abc123',
    link: 'https://example.com',
    comment: 'Test comment',
    ua: 'Mozilla/5.0',
    ip: '127.0.0.1',
    state: 'visible',
    created: Date.now(),
    updated: null,
    pid: null,
    rid: null,
    like: 0,
    dislike: 0,
    isSpam: false,
    isTop: false,
    isPinned: false,
    image: null,
    sticker: null,
    ipRegion: null,
    tags: null,
    renderedComment: null,
    ...overrides,
  }
}

// ========== relTime ==========

describe('relTime', () => {
  it('returns "刚刚" for timestamps less than 1 minute ago (zh default)', () => {
    const ts = Date.now() - 30_000 // 30 seconds ago
    expect(relTime(ts)).toBe('刚刚')
  })

  it('returns "just now" for English locale', () => {
    const ts = Date.now() - 30_000
    expect(relTime(ts, 'en-US')).toBe('just now')
  })

  it('returns "zh-CN" format for locale starting with "zh"', () => {
    const ts = Date.now() - 30_000
    expect(relTime(ts, 'zh-TW')).toBe('刚刚')
  })

  it('returns minutes format for less than 1 hour ago', () => {
    const ts = Date.now() - 5 * 60_000 // 5 minutes ago
    expect(relTime(ts)).toBe('5 分钟前')
    expect(relTime(ts, 'en-US')).toBe('5 min ago')
  })

  it('returns hours format for less than 1 day ago', () => {
    const ts = Date.now() - 3 * 3_600_000 // 3 hours ago
    expect(relTime(ts)).toBe('3 小时前')
    expect(relTime(ts, 'en-US')).toBe('3 hr ago')
  })

  it('returns days format for less than 1 week ago', () => {
    const ts = Date.now() - 3 * 86_400_000 // 3 days ago
    expect(relTime(ts)).toBe('3 天前')
    expect(relTime(ts, 'en-US')).toBe('3 days ago')
  })

  it('returns date string for more than 1 week ago', () => {
    const ts = Date.now() - 10 * 86_400_000 // 10 days ago
    const resultZh = relTime(ts)
    const resultEn = relTime(ts, 'en-US')
    // Both should produce a localized date string containing "/" separator
    expect(resultZh).toMatch(/\d{1,2}\/\d{1,2}/)
    expect(resultEn).toMatch(/\d{1,2}\/\d{1,2}/)
  })

  it('handles future timestamp (negative diff)', () => {
    const ts = Date.now() + 30_000 // 30 seconds in the future
    const result = relTime(ts)
    // diff < 0 < 60000, so returns "刚刚"
    expect(result).toBe('刚刚')
  })
})

// ========== stripPrivate ==========

describe('stripPrivate', () => {
  it('returns null for null input', () => {
    expect(stripPrivate(null)).toBeNull()
  })

  it('removes ip and mail fields', () => {
    const comment = makeComment({ ip: '127.0.0.1', mail: 'test@example.com' })
    const result = stripPrivate(comment)!
    expect('ip' in result).toBe(false)
    expect('mail' in result).toBe(false)
  })

  it('adds relativeTime field', () => {
    const comment = makeComment({ created: Date.now() - 30_000 })
    const result = stripPrivate(comment)!
    expect(result.relativeTime).toBe('刚刚')
  })

  it('preserves all non-private fields', () => {
    const comment = makeComment({ nick: 'TestUser', comment: 'Hello', like: 5, dislike: 2 })
    const result = stripPrivate(comment)!
    expect(result.nick).toBe('TestUser')
    expect(result.comment).toBe('Hello')
    expect(result.id).toBe('test-id')
    expect(result.like).toBe(5)
    expect(result.dislike).toBe(2)
    expect(result.isSpam).toBe(false)
  })
})

// ========== fromRow (SQLite) ==========

describe('fromRow', () => {
  it('returns null for null input', () => {
    expect(fromRow(null)).toBeNull()
  })

  it('returns undefined for undefined input', () => {
    expect(fromRow(undefined)).toBeUndefined()
  })

  it('converts integer 1 to true for boolean fields', () => {
    const result = fromRow({ isSpam: 1, isTop: 0, isPinned: 1, like: 0, dislike: 0 }) as Comment
    expect(result.isSpam).toBe(true)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(true)
  })

  it('converts integer 0 to false for boolean fields', () => {
    const result = fromRow({ isSpam: 0, isTop: 0, isPinned: 0, like: 0, dislike: 0 }) as Comment
    expect(result.isSpam).toBe(false)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(false)
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const result = fromRow({ isSpam: 0, isTop: 0, isPinned: 0, like: null, dislike: undefined }) as Comment
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('preserves existing like and dislike values', () => {
    const result = fromRow({ isSpam: 0, isTop: 0, isPinned: 0, like: 10, dislike: 3 }) as Comment
    expect(result.like).toBe(10)
    expect(result.dislike).toBe(3)
  })

  it('preserves other fields from the row', () => {
    const row = { id: 'c1', nick: 'User', comment: 'Hi', url: '/page', isSpam: 0, isTop: 0, isPinned: 0, like: 5, dislike: 2 }
    const result = fromRow(row) as Comment
    expect(result.id).toBe('c1')
    expect(result.nick).toBe('User')
    expect(result.comment).toBe('Hi')
    expect(result.url).toBe('/page')
  })

  it('handles empty object', () => {
    const result = fromRow({}) as Comment
    expect(result.isSpam).toBe(false)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(false)
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })
})

// ========== fromRowPg (PostgreSQL) ==========

describe('fromRowPg', () => {
  it('returns null for null input', () => {
    expect(fromRowPg(null)).toBeNull()
  })

  it('returns undefined for undefined input', () => {
    expect(fromRowPg(undefined)).toBeUndefined()
  })

  it('keeps native boolean values as-is', () => {
    const result = fromRowPg({ isSpam: true, isTop: false, isPinned: true, like: 3, dislike: 1 }) as Comment
    expect(result.isSpam).toBe(true)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(true)
  })

  it('defaults booleans to false when null/undefined', () => {
    const result = fromRowPg({ isSpam: null, isTop: undefined, isPinned: null, like: 0, dislike: 0 }) as Comment
    expect(result.isSpam).toBe(false)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(false)
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const result = fromRowPg({ isSpam: false, isTop: false, isPinned: false, like: null, dislike: undefined }) as Comment
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('preserves other fields from the row', () => {
    const row = { id: 'pg-1', nick: 'PgUser', comment: 'Hello', isSpam: false, isTop: true, isPinned: false, like: 7, dislike: 1 }
    const result = fromRowPg(row) as Comment
    expect(result.id).toBe('pg-1')
    expect(result.nick).toBe('PgUser')
    expect(result.isTop).toBe(true)
  })
})

// ========== normalizeDoc (MongoDB) ==========

describe('normalizeDoc', () => {
  it('returns null for null input', () => {
    expect(normalizeDoc(null)).toBeNull()
  })

  it('returns undefined for undefined input', () => {
    expect(normalizeDoc(undefined)).toBeUndefined()
  })

  it('converts _id to id', () => {
    const doc = { _id: 'mongo-id', nick: 'User', comment: 'Hi', like: 0, dislike: 0 }
    const result = normalizeDoc(doc) as Comment
    expect(result.id).toBe('mongo-id')
    expect('_id' in result).toBe(false)
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const doc = { _id: 'mongo-id', like: null, dislike: undefined }
    const result = normalizeDoc(doc) as Comment
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('preserves existing like and dislike values', () => {
    const doc = { _id: 'mongo-id', like: 5, dislike: 2 }
    const result = normalizeDoc(doc) as Comment
    expect(result.like).toBe(5)
    expect(result.dislike).toBe(2)
  })

  it('preserves other fields from the doc', () => {
    const doc = { _id: 'mongo-id', nick: 'MongoUser', comment: 'Hello', like: 1, dislike: 0 }
    const result = normalizeDoc(doc) as Comment
    expect(result.nick).toBe('MongoUser')
    expect(result.comment).toBe('Hello')
  })
})

// ========== commentToSqliteRow ==========

describe('commentToSqliteRow', () => {
  it('converts true booleans to integer 1', () => {
    const input = makeComment({ isSpam: true, isTop: true, isPinned: true })
    const result = commentToSqliteRow(input)
    expect(result.isSpam).toBe(1)
    expect(result.isTop).toBe(1)
    expect(result.isPinned).toBe(1)
  })

  it('converts false booleans to integer 0', () => {
    const input = makeComment({ isSpam: false, isTop: false, isPinned: false })
    const result = commentToSqliteRow(input)
    expect(result.isSpam).toBe(0)
    expect(result.isTop).toBe(0)
    expect(result.isPinned).toBe(0)
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const input = makeComment()
    const result = commentToSqliteRow({ ...input, like: null as any, dislike: undefined as any })
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('preserves existing like and dislike values', () => {
    const input = makeComment({ like: 10, dislike: 3 })
    const result = commentToSqliteRow(input)
    expect(result.like).toBe(10)
    expect(result.dislike).toBe(3)
  })

  it('preserves all other fields', () => {
    const input = makeComment({ nick: 'User', comment: 'Hi', id: 'row-1' })
    const result = commentToSqliteRow(input)
    expect(result.nick).toBe('User')
    expect(result.comment).toBe('Hi')
    expect(result.id).toBe('row-1')
    expect(result.url).toBe('/test')
  })
})

// ========== commentToPgRow ==========

describe('commentToPgRow', () => {
  it('keeps boolean values as-is (native PG boolean)', () => {
    const input = makeComment({ isSpam: true, isTop: false, isPinned: true })
    const result = commentToPgRow(input)
    expect(result.isSpam).toBe(true)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(true)
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const input = makeComment()
    const result = commentToPgRow({ ...input, like: null as any, dislike: undefined as any })
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('preserves existing like and dislike values', () => {
    const input = makeComment({ like: 10, dislike: 3 })
    const result = commentToPgRow(input)
    expect(result.like).toBe(10)
    expect(result.dislike).toBe(3)
  })

  it('preserves all other fields', () => {
    const input = makeComment({ nick: 'User', comment: 'Hi', id: 'pg-row-1' })
    const result = commentToPgRow(input)
    expect(result.nick).toBe('User')
    expect(result.comment).toBe('Hi')
    expect(result.id).toBe('pg-row-1')
  })
})

// ========== commentToDoc (MongoDB) ==========

describe('commentToDoc', () => {
  it('converts id to _id', () => {
    const input = makeComment({ id: 'doc-id' })
    const result = commentToDoc(input)
    expect(result._id).toBe('doc-id')
  })

  it('includes all expected fields', () => {
    const input = makeComment({
      id: 'doc-id',
      url: '/page',
      href: 'https://example.com',
      nick: 'User',
      mail: 'user@test.com',
      mailMd5: 'md5hash',
      link: 'https://link.com',
      comment: 'Hi',
      ua: 'UA',
      ip: '1.2.3.4',
      state: 'visible',
      created: 1234567890,
      updated: 1234567891,
      pid: 'parent',
      rid: 'root',
      like: 5,
      dislike: 1,
      isSpam: true,
      isTop: false,
      isPinned: true,
      image: 'img.png',
      sticker: 'sticker',
      ipRegion: 'CN',
      tags: 'tag1,tag2',
      renderedComment: '<p>rendered</p>',
    })
    const result = commentToDoc(input)
    expect(result._id).toBe('doc-id')
    expect(result.url).toBe('/page')
    expect(result.href).toBe('https://example.com')
    expect(result.nick).toBe('User')
    expect(result.mail).toBe('user@test.com')
    expect(result.mailMd5).toBe('md5hash')
    expect(result.link).toBe('https://link.com')
    expect(result.comment).toBe('Hi')
    expect(result.ua).toBe('UA')
    expect(result.ip).toBe('1.2.3.4')
    expect(result.state).toBe('visible')
    expect(result.created).toBe(1234567890)
    expect(result.updated).toBe(1234567891)
    expect(result.pid).toBe('parent')
    expect(result.rid).toBe('root')
    expect(result.like).toBe(5)
    expect(result.dislike).toBe(1)
    expect(result.isSpam).toBe(true)
    expect(result.isTop).toBe(false)
    expect(result.isPinned).toBe(true)
    expect(result.image).toBe('img.png')
    expect(result.sticker).toBe('sticker')
    expect(result.ipRegion).toBe('CN')
    expect(result.tags).toBe('tag1,tag2')
    expect(result.renderedComment).toBe('<p>rendered</p>')
  })

  it('defaults like and dislike to 0 when null/undefined', () => {
    const input = makeComment()
    const result = commentToDoc({ ...input, like: null as any, dislike: undefined as any })
    expect(result.like).toBe(0)
    expect(result.dislike).toBe(0)
  })

  it('does not include relativeTime, children, or replyCount', () => {
    const input = makeComment({ id: 'doc-id' })
    const result = commentToDoc(input) as any
    expect(result.relativeTime).toBeUndefined()
    expect(result.children).toBeUndefined()
    expect(result.replyCount).toBeUndefined()
  })
})

// ========== COMMENT_STATE constants ==========

describe('COMMENT_STATE', () => {
  it('exports all four state constants', () => {
    expect(COMMENT_STATE.VISIBLE).toBe('visible')
    expect(COMMENT_STATE.HIDDEN).toBe('hidden')
    expect(COMMENT_STATE.SPAM).toBe('spam')
    expect(COMMENT_STATE.PENDING).toBe('pending')
  })
})
