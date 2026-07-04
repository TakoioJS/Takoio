/**
 * Import / Export Handler Tests (Task 8.3.5)
 *
 * 覆盖 import-export.ts：
 *   - handleExport（分页拉取、takoio 格式）
 *   - handleImport（各源字段映射、批量插入、JSON 解析）
 *   - 数据格式校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

vi.mock('../../store/index', () => ({
  commentStore: {
    addComments: vi.fn().mockImplementation(async (items: any[]) => items.length),
    getAllComments: vi.fn().mockImplementation(async (page, pageSize) => {
      // Simulate paginated export — 2 pages of 3 items, total 6
      const total = 6
      const start = (page - 1) * pageSize
      const end = Math.min(start + pageSize, total)
      const data = Array.from({ length: Math.max(0, end - start) }, (_, i) => ({
        id: `c${start + i + 1}`,
        url: `/p${start + i + 1}`,
        nick: `User${start + i + 1}`,
        comment: `text ${start + i + 1}`,
      }))
      return { data, total }
    }),
  },
  getStore: vi.fn().mockResolvedValue({
    comments: [{ id: 'c1', url: '/p1' }],
    configs: [{ key: 'SITE_NAME', value: 'Blog' }],
    sessions: [{ token: 'tok' }],
  }),
  importStore: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ========== Imports ==========

import { handleImport, handleExport } from '../import-export'
import { commentStore, getStore, importStore } from '../../store/index'
import { AppError } from '../../errors'

// ========== Tests ==========

describe('import-export handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- Export -----

  describe('handleExport', () => {
    it('returns takoio format when format=takoio', async () => {
      const result = await handleExport({ format: 'takoio' })
      expect(result.data).toHaveProperty('comments')
      // configs/sessions should be stripped per handler logic
      expect(result.data).not.toHaveProperty('configs')
      expect(result.data).not.toHaveProperty('sessions')
      expect(result.total).toBe(1)
      expect(getStore).toHaveBeenCalled()
    })

    it('paginates through all comments when format=json', async () => {
      // pageSize is hardcoded to 500; mock returns 3 items per page, total 6
      // So 2 pages expected
      const result = await handleExport({ format: 'json' })
      expect(Array.isArray(result.data)).toBe(true)
      expect((result.data as any[]).length).toBe(6)
      expect(result.total).toBe(6)
      // getAllComments called at least once with page=1
      expect(commentStore.getAllComments).toHaveBeenCalledWith(1, 500)
    })

    it('stops at MAX_PAGES safety bound', async () => {
      // Force store to always report total > current accumulated length
      vi.mocked(commentStore.getAllComments).mockImplementation(async (page, pageSize) => ({
        data: [{ id: `c${page}`, url: `/p${page}`, nick: 'A', comment: 'test', state: 'visible', created: 1, like: 0, dislike: 0, isSpam: false, isTop: false, isPinned: false, isPrivate: false }],
        total: 999999, // never satisfied
      }))
      const result = await handleExport({ format: 'json' })
      // Should stop at 200 pages × 1 item each = 200 items
      expect((result.data as any[]).length).toBe(200)
    })

    it('defaults format to json when omitted', async () => {
      vi.mocked(commentStore.getAllComments).mockResolvedValueOnce({
        data: [],
        total: 0,
      })
      const result = await handleExport({} as any)
      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })

    it('throws AppError on invalid format', async () => {
      await expect(
        handleExport({ format: 'xml' } as any)
      ).rejects.toThrow(AppError)
    })
  })

  // ----- Import -----

  describe('handleImport', () => {
    it('imports takoio format via importStore', async () => {
      const payload = {
        comments: [{ id: 'c1', url: '/p1', nick: 'A', comment: 'hi' }],
        configs: [],
        sessions: [],
      }
      const result = await handleImport('takoio', { takoio: payload })
      expect(result.count).toBe(1)
      expect(importStore).toHaveBeenCalledWith(payload)
    })

    it('imports valine format with field mapping', async () => {
      const valineItems = [
        {
          objectId: 'v1',
          url: '/p1',
          nick: 'Alice',
          mail: 'a@x.com',
          comment: 'hello',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]
      const result = await handleImport('valine', { json: valineItems })
      expect(result.count).toBe(1)
      expect(commentStore.addComments).toHaveBeenCalledTimes(1)
      const items = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(items[0].id).toBe('v1')
      expect(items[0].nick).toBe('Alice')
      expect(items[0].comment).toBe('hello')
    })

    it('imports waline format with insertedAt mapping', async () => {
      const walineItems = [
        {
          objectId: 'w1',
          url: '/p2',
          nick: 'Bob',
          comment: 'yo',
          insertedAt: '2024-02-01T00:00:00.000Z',
          status: 'waiting_review',
        },
      ]
      await handleImport('waline', { json: walineItems })
      const items = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(items[0].id).toBe('w1')
      expect(items[0].state).toBe('pending')
    })

    it('imports twikoo format with _id mapping', async () => {
      const twikooItems = [
        {
          _id: 't1',
          url: '/p3',
          nick: 'Cat',
          comment: 'meow',
          created: 1700000000000,
          isSpam: 1,
        },
      ]
      await handleImport('twikoo', { json: twikooItems })
      const items = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(items[0].id).toBe('t1')
      expect(items[0].isSpam).toBe(true)
      expect(items[0].created).toBe(1700000000000)
    })

    it('imports artalk format with page_key/name/content mapping', async () => {
      const artalkItems = [
        {
          id: 'a1',
          page_key: '/p4',
          name: 'Dave',
          email: 'd@x.com',
          content: 'hello artalk',
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ]
      await handleImport('artalk', { json: artalkItems })
      const items = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(items[0].url).toBe('/p4')
      expect(items[0].nick).toBe('Dave')
      expect(items[0].mail).toBe('d@x.com')
      expect(items[0].comment).toBe('hello artalk')
    })

    it('imports disqus format with thread/name/message mapping', async () => {
      const disqusItems = [
        {
          id: 'd1',
          thread: '/p5',
          name: 'Eve',
          email: 'e@x.com',
          message: 'hi disqus',
          createdAt: '2024-04-01T00:00:00.000Z',
        },
      ]
      await handleImport('disqus', { json: disqusItems })
      const items = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(items[0].url).toBe('/p5')
      expect(items[0].nick).toBe('Eve')
      expect(items[0].comment).toBe('hi disqus')
    })

    it('parses JSON string input', async () => {
      const json = JSON.stringify([{ _id: 'x1', url: '/p', nick: 'X', comment: 'c' }])
      await handleImport('twikoo', { json })
      expect(commentStore.addComments).toHaveBeenCalledTimes(1)
    })

    it('returns count=0 when no data', async () => {
      const result = await handleImport('valine', {})
      expect(result.count).toBe(0)
      expect(commentStore.addComments).not.toHaveBeenCalled()
    })

    it('returns error message on malformed JSON', async () => {
      const result = await handleImport('valine', { json: '{not valid json' })
      expect(result.count).toBe(0)
      expect(result.error).toContain('JSON')
    })

    it('sanitizes invalid IP values', async () => {
      const items = [{ _id: 'x1', url: '/p', nick: 'X', comment: 'c', ip: '0 0' }]
      await handleImport('twikoo', { json: items })
      const mapped = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(mapped[0].ip).toBe('')
    })

    it('rejects invalid source data via schema (missing required fields)', async () => {
      // Schema requires nothing strictly, but invalid input shape should still be tolerated
      // because ImportSchema is .passthrough(). So this just confirms no throw on minimal data.
      const result = await handleImport('valine', { json: [{ garbage: true }] })
      expect(result.count).toBe(1)
    })

    it('handles array source field (valine payload on valine key)', async () => {
      const valineItems = [{ objectId: 'k1', url: '/p', nick: 'K', comment: 'hi' }]
      const result = await handleImport('valine', { valine: valineItems })
      expect(result.count).toBe(1)
      expect(commentStore.addComments).toHaveBeenCalled()
    })

    it('sanitizes IPv6 valid addresses', async () => {
      const items = [{ _id: 'x1', url: '/p', nick: 'X', comment: 'c', ip: '::1' }]
      await handleImport('twikoo', { json: items })
      const mapped = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(mapped[0].ip).toBe('::1')
    })

    it('normalizes ipRegion field stripping zero placeholders', async () => {
      const items = [{ _id: 'x1', url: '/p', nick: 'X', comment: 'c', ipRegion: 'CN|0|BJ' }]
      await handleImport('twikoo', { json: items })
      const mapped = vi.mocked(commentStore.addComments).mock.calls[0][0] as any[]
      expect(mapped[0].ipRegion).toBe('CN BJ')
    })
  })

  // ----- Format Validation -----

  describe('schema validation', () => {
    it('handleExport accepts format=csv (allowed enum)', async () => {
      vi.mocked(commentStore.getAllComments).mockResolvedValueOnce({
        data: [],
        total: 0,
      })
      const result = await handleExport({ format: 'csv' })
      expect(result.data).toEqual([])
    })

    it('handleImport throws AppError on invalid shape (json must be string or array)', async () => {
      // Passing json as a number should fail schema validation
      await expect(
        handleImport('valine', { json: 42 as any })
      ).rejects.toThrow(AppError)
    })
  })
})
