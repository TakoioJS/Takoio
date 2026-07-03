/**
 * Comment Admin Handler Tests (Task 8.3.1)
 *
 * 覆盖 comment-admin.ts 的 8 个 handler：
 *   handleCommentUpdate / handleCommentDelete / handleCommentHide
 *   handleCommentGetAdmin / handleCommentSetTop / handleCommentSetSpam
 *   handleCommentApprove / handleCommentBatch
 *
 * 注：handler 内部动态 import('../store/redis') 与 import('../utils/logger')，
 * 这里通过 vi.mock 提前替换模块。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

vi.mock('../../store/index', () => ({
  commentStore: {
    updateComment: vi.fn().mockResolvedValue(true),
    deleteComment: vi.fn().mockResolvedValue(true),
    hideComment: vi.fn().mockResolvedValue(true),
    showComment: vi.fn().mockResolvedValue(true),
    setTop: vi.fn().mockResolvedValue(true),
    setSpam: vi.fn().mockResolvedValue(true),
    getComment: vi.fn().mockResolvedValue({ id: 'c1', url: '/test', nick: 'A' }),
    getAllComments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    searchComments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  },
}))

vi.mock('../../store/redis', () => ({
  invalidateCommentListCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      SITE_URL: 'https://example.com',
      MASTER: 'admin@example.com',
      MASTER_NAME: 'Admin',
    }),
  }
})

vi.mock('../../utils/render', () => ({
  renderComment: vi.fn().mockResolvedValue('<p>rendered</p>'),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ========== Imports ==========

import {
  handleCommentUpdate,
  handleCommentDelete,
  handleCommentHide,
  handleCommentGetAdmin,
  handleCommentSetTop,
  handleCommentSetSpam,
  handleCommentApprove,
  handleCommentBatch,
} from '../comment-admin'
import { commentStore } from '../../store/index'
import { AppError } from '../../errors'

// ========== Tests ==========

describe('comment-admin handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- handleCommentUpdate -----

  describe('handleCommentUpdate', () => {
    it('updates a comment with valid input', async () => {
      const result = await handleCommentUpdate({
        id: 'c1',
        nick: 'NewNick',
        comment: 'updated text',
      })
      expect(result).toEqual({ success: true })
      expect(commentStore.updateComment).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ nick: 'NewNick', comment: 'updated text' })
      )
    })

    it('throws AppError on invalid input (missing id)', async () => {
      await expect(
        handleCommentUpdate({ id: '', nick: 'X' } as any)
      ).rejects.toThrow(AppError)
      expect(commentStore.updateComment).not.toHaveBeenCalled()
    })

    it('handles optional mail with md5 hash', async () => {
      const result = await handleCommentUpdate({
        id: 'c1',
        mail: 'user@example.com',
      })
      expect(result).toEqual({ success: true })
      const arg = vi.mocked(commentStore.updateComment).mock.calls[0][1] as any
      expect(arg.mailMd5).toMatch(/^[a-f0-9]{32}$/)
    })
  })

  // ----- handleCommentDelete -----

  describe('handleCommentDelete', () => {
    it('deletes a comment by id', async () => {
      const result = await handleCommentDelete({ id: 'c1' })
      expect(result).toEqual({ success: true })
      expect(commentStore.deleteComment).toHaveBeenCalledWith('c1')
    })

    it('returns false when store reports not found', async () => {
      vi.mocked(commentStore.deleteComment).mockResolvedValueOnce(false)
      const result = await handleCommentDelete({ id: 'missing' })
      expect(result.success).toBe(false)
    })

    it('throws AppError on empty id', async () => {
      await expect(handleCommentDelete({ id: '' })).rejects.toThrow(AppError)
    })
  })

  // ----- handleCommentHide -----

  describe('handleCommentHide', () => {
    it('hides a comment when hide=true', async () => {
      const result = await handleCommentHide({ id: 'c1', hide: true })
      expect(result).toEqual({ success: true })
      expect(commentStore.hideComment).toHaveBeenCalledWith('c1')
      expect(commentStore.showComment).not.toHaveBeenCalled()
    })

    it('shows a comment when hide=false', async () => {
      const result = await handleCommentHide({ id: 'c1', hide: false })
      expect(result).toEqual({ success: true })
      expect(commentStore.showComment).toHaveBeenCalledWith('c1')
      expect(commentStore.hideComment).not.toHaveBeenCalled()
    })

    it('defaults to show when hide omitted', async () => {
      await handleCommentHide({ id: 'c1' })
      expect(commentStore.showComment).toHaveBeenCalledWith('c1')
    })

    it('throws on empty id', async () => {
      await expect(handleCommentHide({ id: '' })).rejects.toThrow(AppError)
    })
  })

  // ----- handleCommentGetAdmin -----

  describe('handleCommentGetAdmin', () => {
    it('calls getAllComments when no search/filter', async () => {
      vi.mocked(commentStore.getAllComments).mockResolvedValueOnce({
        data: [{ id: 'c1', url: '/test', nick: 'A' }],
        total: 1,
      })
      const result = await handleCommentGetAdmin({ page: 1, pageSize: 20 })
      expect(commentStore.getAllComments).toHaveBeenCalledWith(1, 20)
      expect(commentStore.searchComments).not.toHaveBeenCalled()
      expect(result.total).toBe(1)
      // markMasterComments adds isMaster flag if matching MASTER_NAME/MASTER
      expect(result.data[0]).toHaveProperty('href')
    })

    it('calls searchComments when search provided', async () => {
      vi.mocked(commentStore.searchComments).mockResolvedValueOnce({
        data: [],
        total: 0,
      })
      await handleCommentGetAdmin({ page: 1, pageSize: 10, search: 'foo' })
      expect(commentStore.searchComments).toHaveBeenCalledWith(1, 10, 'foo', undefined)
      expect(commentStore.getAllComments).not.toHaveBeenCalled()
    })

    it('calls searchComments when filter != all', async () => {
      vi.mocked(commentStore.searchComments).mockResolvedValueOnce({
        data: [],
        total: 0,
      })
      await handleCommentGetAdmin({ page: 1, pageSize: 10, filter: 'spam' })
      expect(commentStore.searchComments).toHaveBeenCalledWith(1, 10, undefined, 'spam')
    })

    it('uses filter=all falls back to getAllComments', async () => {
      vi.mocked(commentStore.getAllComments).mockResolvedValueOnce({
        data: [],
        total: 0,
      })
      await handleCommentGetAdmin({ page: 1, pageSize: 10, filter: 'all' })
      expect(commentStore.getAllComments).toHaveBeenCalled()
    })
  })

  // ----- handleCommentSetTop -----

  describe('handleCommentSetTop', () => {
    it('pins a comment when isTop not provided', async () => {
      const result = await handleCommentSetTop({ id: 'c1' })
      expect(result).toEqual({ success: true })
      expect(commentStore.setTop).toHaveBeenCalledWith('c1', true)
    })

    it('unpins a comment when isTop=false', async () => {
      const result = await handleCommentSetTop({ id: 'c1', isTop: false })
      expect(result).toEqual({ success: true })
      expect(commentStore.setTop).toHaveBeenCalledWith('c1', false)
    })

    it('throws on empty id', async () => {
      await expect(handleCommentSetTop({ id: '' })).rejects.toThrow(AppError)
    })
  })

  // ----- handleCommentSetSpam -----

  describe('handleCommentSetSpam', () => {
    it('marks spam by default', async () => {
      const result = await handleCommentSetSpam({ id: 'c1' })
      expect(result).toEqual({ success: true })
      expect(commentStore.setSpam).toHaveBeenCalledWith('c1', true)
    })

    it('unmarks spam when isSpam=false', async () => {
      const result = await handleCommentSetSpam({ id: 'c1', isSpam: false })
      expect(result).toEqual({ success: true })
      expect(commentStore.setSpam).toHaveBeenCalledWith('c1', false)
    })

    it('throws on empty id', async () => {
      await expect(handleCommentSetSpam({ id: '' })).rejects.toThrow(AppError)
    })
  })

  // ----- handleCommentApprove -----

  describe('handleCommentApprove', () => {
    it('approves a pending comment (calls showComment)', async () => {
      const result = await handleCommentApprove({ id: 'c1' })
      expect(result).toEqual({ success: true })
      expect(commentStore.showComment).toHaveBeenCalledWith('c1')
    })

    it('throws on empty id', async () => {
      await expect(handleCommentApprove({ id: '' })).rejects.toThrow(AppError)
    })
  })

  // ----- handleCommentBatch -----

  describe('handleCommentBatch', () => {
    it('throws when ids is empty array', async () => {
      await expect(
        handleCommentBatch({ ids: [], action: 'delete' })
      ).rejects.toThrow(AppError)
    })

    it('throws when ids is not an array', async () => {
      await expect(
        handleCommentBatch({ ids: null as any, action: 'delete' })
      ).rejects.toThrow(AppError)
    })

    it('throws when ids exceeds 500', async () => {
      const ids = Array.from({ length: 501 }, (_, i) => String(i))
      await expect(
        handleCommentBatch({ ids, action: 'delete' })
      ).rejects.toThrow(AppError)
    })

    it('throws on unsupported action', async () => {
      await expect(
        handleCommentBatch({ ids: ['c1'], action: 'bogus' as any })
      ).rejects.toThrow(AppError)
    })

    it('executes hide action for all ids', async () => {
      const result = await handleCommentBatch({ ids: ['c1', 'c2'], action: 'hide' })
      expect(result.success).toBe(true)
      expect(result.total).toBe(2)
      expect(result.failed).toBe(0)
      expect(commentStore.hideComment).toHaveBeenCalledTimes(2)
    })

    it('executes show action (approve alias)', async () => {
      await handleCommentBatch({ ids: ['c1'], action: 'show' })
      expect(commentStore.showComment).toHaveBeenCalledWith('c1')
    })

    it('executes delete action', async () => {
      await handleCommentBatch({ ids: ['c1'], action: 'delete' })
      expect(commentStore.deleteComment).toHaveBeenCalledWith('c1')
    })

    it('executes spam action', async () => {
      await handleCommentBatch({ ids: ['c1'], action: 'spam' })
      expect(commentStore.setSpam).toHaveBeenCalledWith('c1', true)
    })

    it('executes unspam action', async () => {
      await handleCommentBatch({ ids: ['c1'], action: 'unspam' })
      expect(commentStore.setSpam).toHaveBeenCalledWith('c1', false)
    })

    it('executes approve action', async () => {
      await handleCommentBatch({ ids: ['c1'], action: 'approve' })
      expect(commentStore.showComment).toHaveBeenCalledWith('c1')
    })

    it('records failed ids when store returns false', async () => {
      vi.mocked(commentStore.hideComment).mockResolvedValueOnce(false)
      const result = await handleCommentBatch({ ids: ['bad', 'ok'], action: 'hide' })
      expect(result.success).toBe(false)
      expect(result.failed).toBe(1)
      expect(result.failedIds).toEqual(['bad'])
      expect(result.errors['bad']).toBeDefined()
    })

    it('captures thrown errors per id', async () => {
      vi.mocked(commentStore.deleteComment).mockRejectedValueOnce(new Error('boom'))
      const result = await handleCommentBatch({ ids: ['x'], action: 'delete' })
      expect(result.success).toBe(false)
      expect(result.failedIds).toEqual(['x'])
      expect(result.errors['x']).toBe('boom')
    })

    it('returns success when all ids succeed', async () => {
      const result = await handleCommentBatch({ ids: ['a', 'b'], action: 'hide' })
      expect(result.success).toBe(true)
      expect(result.failedIds).toEqual([])
    })
  })
})
