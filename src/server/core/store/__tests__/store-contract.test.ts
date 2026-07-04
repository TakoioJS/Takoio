/**
 * Store Contract Tests — SQLite 实现
 *
 * 使用真实 @libsql/client 内存库验证 sqlite commentStore 的
 * addComment / getComments / updateComment / deleteComment 行为：
 *   - 插入评论后能查询到
 *   - getComments 分页正确
 *   - updateComment 修改字段后查询到新值
 *   - deleteComment 后查询不到
 *   - 不同 state（visible / pending / spam / hidden）的过滤
 *
 * 内存库 URI 说明：
 * 使用 `file::memory:?cache=shared` 而非 `:memory:`。
 * @libsql/client 的 transaction() 内部会将缓存的连接置 null（sqlite3.js:158），
 * 导致下次调用时新建连接。对于 `:memory:`，每个新连接会获得独立的空数据库，
 * 使 deleteComment 事务后的查询报 "no such table: comments"。
 * `cache=shared` 让所有连接共享同一个内存数据库，事务后新建的连接仍能访问到表与数据。
 *
 * PostgreSQL 测试说明：
 * pg-mem 未安装为项目依赖，且完整 mock drizzle-orm postgres-js 客户端链式 API
 * （insert/select/update/delete + where/orderBy/limit/offset/returning/transaction
 * + eq/and/inArray/sql/asc/desc/count）复杂度过高、易引入假阳性。
 * 因此 PostgreSQL contract 测试在此文件中跳过。
 * PostgreSQL 专有的数据转换函数（fromRowPg / commentToPgRow）已在
 * store-utils.test.ts 中覆盖。
 *
 * 启用 PostgreSQL 测试方法：
 *   pnpm add -D pg-mem
 * 然后用 pg-mem 创建内存 PG 实例并 mock ../db/pg-client 的 getDb/initDb。
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'

// 必须在引入依赖 client.ts 的模块之前 mock env，使 LIBSQL_URL 指向共享内存库
vi.mock('../../env', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    LIBSQL_URL: 'file::memory:?cache=shared',
    LIBSQL_AUTH_TOKEN: undefined,
    LIBSQL_DATA_DIR: undefined,
  }
})

import { closeDb, getDb, initDb } from '../../db/client'
import { comments, commentReactions } from '../../db/schema'
import { commentStore } from '../sqlite'
import type { CommentInput } from '../types'

let commentCounter = 0

/** 构造一个完整的 CommentInput 对象用于测试 */
function makeComment (overrides: Partial<CommentInput> = {}): CommentInput {
  commentCounter++
  const base = Date.now() + commentCounter
  return {
    id: `c-${commentCounter}`,
    url: '/test-page',
    href: 'https://example.com/test-page',
    nick: 'TestUser',
    mail: 'test@example.com',
    mailMd5: 'abc123def456',
    link: 'https://example.com',
    comment: `Test comment ${commentCounter}`,
    ua: 'Mozilla/5.0',
    ip: '127.0.0.1',
    state: 'visible',
    created: base,
    updated: null,
    pid: null,
    rid: null,
    like: 0,
    dislike: 0,
    isSpam: false,
    isTop: false,
    isPinned: false,
    isPrivate: false,
    image: null,
    sticker: null,
    ipRegion: null,
    tags: null,
    renderedComment: null,
    ...overrides,
  }
}

describe('SQLite commentStore contract', () => {
  // 共享内存库只需初始化一次：closeDb/initDb 循环会破坏事务后残留的连接引用，
  // 导致 cache=shared 内存库状态不一致。改为 beforeAll 初始化 + beforeEach 清表。
  beforeAll(async () => {
    getDb()
    await initDb()
  })

  beforeEach(async () => {
    // 清空 comments 及关联的 comment_reactions 表，确保测试间数据隔离
    await getDb().delete(commentReactions).run()
    await getDb().delete(comments).run()
  })

  afterAll(async () => {
    await closeDb()
  })

  // ========== addComment ==========

  describe('addComment', () => {
    it('inserts a comment and returns it with relativeTime / children / replyCount', async () => {
      const input = makeComment()
      const result = await commentStore.addComment(input)

      expect(result.id).toBe(input.id)
      expect(result.nick).toBe(input.nick)
      expect(result.comment).toBe(input.comment)
      expect(result.url).toBe(input.url)
      // addComment 返回 Comment；relativeTime/children/replyCount 是 CommentListItem 字段
      const listItem = result as any
      expect(listItem.relativeTime).toBeDefined()
      expect(typeof listItem.relativeTime).toBe('string')
      expect(listItem.children).toEqual([])
      expect(listItem.replyCount).toBe(0)
    })

    it('persists the comment so it can be retrieved by getComment', async () => {
      const input = makeComment({ id: 'persist-test', comment: 'Hello World' })
      await commentStore.addComment(input)

      const retrieved = await commentStore.getComment('persist-test')
      expect(retrieved).toBeDefined()
      expect(retrieved!.nick).toBe('TestUser')
      expect(retrieved!.comment).toBe('Hello World')
      expect(retrieved!.url).toBe('/test-page')
    })

    it('round-trips boolean fields through SQLite integer storage', async () => {
      const input = makeComment({ id: 'bool-test', isSpam: true, isTop: true, isPinned: true })
      await commentStore.addComment(input)

      const retrieved = await commentStore.getComment('bool-test')
      expect(retrieved).toBeDefined()
      // SQLite stores 0/1; fromRow converts back to boolean
      expect(retrieved!.isSpam).toBe(true)
      expect(retrieved!.isTop).toBe(true)
      expect(retrieved!.isPinned).toBe(true)
    })

    it('round-trips false boolean fields through SQLite integer storage', async () => {
      const input = makeComment({ id: 'bool-false', isSpam: false, isTop: false, isPinned: false })
      await commentStore.addComment(input)

      const retrieved = await commentStore.getComment('bool-false')
      expect(retrieved).toBeDefined()
      expect(retrieved!.isSpam).toBe(false)
      expect(retrieved!.isTop).toBe(false)
      expect(retrieved!.isPinned).toBe(false)
    })

    it('persists like / dislike counts', async () => {
      const input = makeComment({ id: 'like-test', like: 42, dislike: 7 })
      await commentStore.addComment(input)

      const retrieved = await commentStore.getComment('like-test')
      expect(retrieved).toBeDefined()
      expect(retrieved!.like).toBe(42)
      expect(retrieved!.dislike).toBe(7)
    })
  })

  // ========== getComments (pagination + state filtering) ==========

  describe('getComments', () => {
    it('returns top-level comments with correct total and page size', async () => {
      for (let i = 0; i < 5; i++) {
        await commentStore.addComment(makeComment({
          id: `page1-${i}`,
          created: Date.now() + i,
        }))
      }

      const page1 = await commentStore.getComments('/test-page', 1, 2)
      expect(page1.data).toHaveLength(2)
      expect(page1.total).toBe(5)
    })

    it('returns correct second page', async () => {
      for (let i = 0; i < 5; i++) {
        await commentStore.addComment(makeComment({
          id: `page2-${i}`,
          created: Date.now() + i,
        }))
      }

      const page2 = await commentStore.getComments('/test-page', 2, 2)
      expect(page2.data).toHaveLength(2)
      expect(page2.total).toBe(5)

      // Page 1 and Page 2 should not overlap
      const page1 = await commentStore.getComments('/test-page', 1, 2)
      const page1Ids = new Set(page1.data.map(c => c.id))
      const page2Ids = new Set(page2.data.map(c => c.id))
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false)
      }
    })

    it('returns empty data array when page is beyond range', async () => {
      await commentStore.addComment(makeComment({ id: 'single' }))

      const result = await commentStore.getComments('/test-page', 2, 10)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(1)
    })

    it('filters by url — only returns comments for the given url', async () => {
      await commentStore.addComment(makeComment({ id: 'url-a', url: '/page-a' }))
      await commentStore.addComment(makeComment({ id: 'url-b', url: '/page-b' }))
      await commentStore.addComment(makeComment({ id: 'url-c', url: '/page-a' }))

      const result = await commentStore.getComments('/page-a', 1, 10)
      expect(result.data).toHaveLength(2)
      const ids = result.data.map(c => c.id)
      expect(ids).toContain('url-a')
      expect(ids).toContain('url-c')
      expect(ids).not.toContain('url-b')
    })

    it('only returns visible and pending states (excludes spam and hidden)', async () => {
      await commentStore.addComment(makeComment({ id: 'st-visible', state: 'visible' }))
      await commentStore.addComment(makeComment({ id: 'st-pending', state: 'pending' }))
      await commentStore.addComment(makeComment({ id: 'st-spam', state: 'spam' }))
      await commentStore.addComment(makeComment({ id: 'st-hidden', state: 'hidden' }))

      const result = await commentStore.getComments('/test-page', 1, 10)
      const ids = result.data.map(c => c.id)
      expect(ids).toContain('st-visible')
      expect(ids).toContain('st-pending')
      expect(ids).not.toContain('st-spam')
      expect(ids).not.toContain('st-hidden')
      expect(result.total).toBe(2)
    })

    it('does not return replies in top-level listing (pid IS NULL filter)', async () => {
      await commentStore.addComment(makeComment({ id: 'parent-1', pid: null }))
      await commentStore.addComment(makeComment({
        id: 'reply-1',
        pid: 'parent-1',
        rid: 'parent-1',
      }))

      const result = await commentStore.getComments('/test-page', 1, 10)
      const ids = result.data.map(c => c.id)
      expect(ids).toContain('parent-1')
      expect(ids).not.toContain('reply-1')
    })

    it('attaches replies as children of parent comments', async () => {
      await commentStore.addComment(makeComment({ id: 'parent-2', pid: null }))
      await commentStore.addComment(makeComment({
        id: 'reply-2a',
        pid: 'parent-2',
        rid: 'parent-2',
        comment: 'Reply A',
      }))
      await commentStore.addComment(makeComment({
        id: 'reply-2b',
        pid: 'parent-2',
        rid: 'parent-2',
        comment: 'Reply B',
      }))

      const result = await commentStore.getComments('/test-page', 1, 10)
      const parent = result.data.find(c => c.id === 'parent-2')
      expect(parent).toBeDefined()
      expect(parent!.children).toHaveLength(2)
      expect(parent!.replyCount).toBe(2)
      const replyIds = parent!.children.map(c => c.id)
      expect(replyIds).toContain('reply-2a')
      expect(replyIds).toContain('reply-2b')
    })

    it('strips private fields (ip, mail) from returned items', async () => {
      await commentStore.addComment(makeComment({
        id: 'strip-test',
        ip: '10.0.0.1',
        mail: 'secret@example.com',
      }))

      const result = await commentStore.getComments('/test-page', 1, 10)
      const item = result.data.find(c => c.id === 'strip-test')
      expect(item).toBeDefined()
      expect('ip' in item!).toBe(false)
      expect('mail' in item!).toBe(false)
      expect(item!.relativeTime).toBeDefined()
    })
  })

  // ========== updateComment ==========

  describe('updateComment', () => {
    it('updates comment text and returns true', async () => {
      await commentStore.addComment(makeComment({ id: 'upd-1', comment: 'Original' }))

      const result = await commentStore.updateComment('upd-1', { comment: 'Updated text' })
      expect(result).toBe(true)

      const retrieved = await commentStore.getComment('upd-1')
      expect(retrieved!.comment).toBe('Updated text')
    })

    it('updates isSpam boolean (converts to SQLite integer internally)', async () => {
      await commentStore.addComment(makeComment({ id: 'upd-spam', isSpam: false }))

      const result = await commentStore.updateComment('upd-spam', { isSpam: true })
      expect(result).toBe(true)

      const retrieved = await commentStore.getComment('upd-spam')
      expect(retrieved!.isSpam).toBe(true)
    })

    it('updates isTop boolean', async () => {
      await commentStore.addComment(makeComment({ id: 'upd-top', isTop: false }))

      await commentStore.updateComment('upd-top', { isTop: true })

      const retrieved = await commentStore.getComment('upd-top')
      expect(retrieved!.isTop).toBe(true)
    })

    it('updates state field', async () => {
      await commentStore.addComment(makeComment({ id: 'upd-state', state: 'visible' }))

      await commentStore.updateComment('upd-state', { state: 'hidden' })

      const retrieved = await commentStore.getComment('upd-state')
      expect(retrieved!.state).toBe('hidden')
    })

    it('updates ipRegion field', async () => {
      await commentStore.addComment(makeComment({ id: 'upd-region', ipRegion: null }))

      await commentStore.updateComment('upd-region', { ipRegion: 'US' })

      const retrieved = await commentStore.getComment('upd-region')
      expect(retrieved!.ipRegion).toBe('US')
    })

    it('returns false when updating non-existent comment', async () => {
      const result = await commentStore.updateComment('non-existent', { comment: 'test' })
      expect(result).toBe(false)
    })

    it('sets the updated timestamp', async () => {
      const before = Date.now()
      await commentStore.addComment(makeComment({ id: 'upd-ts', updated: null }))

      await commentStore.updateComment('upd-ts', { comment: 'changed' })

      const retrieved = await commentStore.getComment('upd-ts')
      expect(retrieved!.updated).not.toBeNull()
      expect(retrieved!.updated).toBeGreaterThanOrEqual(before)
    })
  })

  // ========== deleteComment ==========

  describe('deleteComment', () => {
    it('deletes a comment so it can no longer be retrieved', async () => {
      await commentStore.addComment(makeComment({ id: 'del-1' }))

      const result = await commentStore.deleteComment('del-1')
      expect(result).toBe(true)

      const retrieved = await commentStore.getComment('del-1')
      expect(retrieved).toBeUndefined()
    })

    it('deletes child replies when deleting a parent comment', async () => {
      await commentStore.addComment(makeComment({ id: 'parent-del', pid: null }))
      await commentStore.addComment(makeComment({
        id: 'child-del',
        pid: 'parent-del',
        rid: 'parent-del',
      }))

      await commentStore.deleteComment('parent-del')

      const parent = await commentStore.getComment('parent-del')
      const child = await commentStore.getComment('child-del')
      expect(parent).toBeUndefined()
      expect(child).toBeUndefined()
    })

    it('returns true even when deleting non-existent comment', async () => {
      // deleteComment always returns true (transaction succeeds with 0 rows affected)
      const result = await commentStore.deleteComment('non-existent')
      expect(result).toBe(true)
    })
  })

  // ========== Cross-method integration ==========

  describe('cross-method integration', () => {
    it('full lifecycle: add → get → update → delete', async () => {
      // Add
      const input = makeComment({ id: 'lifecycle', comment: 'Original', state: 'visible' })
      await commentStore.addComment(input)

      // Verify added
      let retrieved = await commentStore.getComment('lifecycle')
      expect(retrieved).toBeDefined()
      expect(retrieved!.comment).toBe('Original')

      // Update
      await commentStore.updateComment('lifecycle', { comment: 'Updated', state: 'pending' })
      retrieved = await commentStore.getComment('lifecycle')
      expect(retrieved!.comment).toBe('Updated')
      expect(retrieved!.state).toBe('pending')

      // Delete
      await commentStore.deleteComment('lifecycle')
      retrieved = await commentStore.getComment('lifecycle')
      expect(retrieved).toBeUndefined()
    })

    it('state filtering affects getComments visibility', async () => {
      // Add as visible
      await commentStore.addComment(makeComment({ id: 'filter-1', state: 'visible' }))

      // Visible in getComments
      let result = await commentStore.getComments('/test-page', 1, 10)
      expect(result.total).toBe(1)

      // Update to spam
      await commentStore.updateComment('filter-1', { state: 'spam' })

      // Should no longer appear in getComments (spam is excluded)
      result = await commentStore.getComments('/test-page', 1, 10)
      expect(result.total).toBe(0)

      // But still retrievable by getComment (admin/internal use)
      const direct = await commentStore.getComment('filter-1')
      expect(direct).toBeDefined()
      expect(direct!.state).toBe('spam')
    })
  })
})

/**
 * PostgreSQL commentStore contract — SKIPPED
 *
 * pg-mem 未安装为项目依赖。完整 mock drizzle-orm postgres-js 客户端链式 API
 * （insert/select/update/delete + where/orderBy/limit/offset/returning/transaction
 * + eq/and/inArray/sql/asc/desc/count）需要重新实现大量 drizzle 查询构造器，
 * 复杂度过高且易引入假阳性。
 *
 * PostgreSQL 专有的数据转换逻辑（fromRowPg / commentToPgRow）已在
 * store-utils.test.ts 中覆盖。
 *
 * 启用方式：pnpm add -D pg-mem，然后用 pg-mem 创建内存 PG 实例
 * 并 mock ../db/pg-client 的 getDb/initDb。
 */
describe.skip('PostgreSQL commentStore contract (skipped: pg-mem not installed)', () => {
  it('placeholder — install pg-mem to enable PostgreSQL contract tests', () => {
    // See comment above for instructions
  })
})
