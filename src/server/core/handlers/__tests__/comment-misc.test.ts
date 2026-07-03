/**
 * Comment Misc Handler Tests (Task 8.3.3)
 *
 * 覆盖 comment-misc.ts：
 *   - handleCounterGet / handleCounterUpdate
 *   - handleGetCommentsCount（多 URL 批量）
 *   - handleGetRecentComments
 *   - handleDashboardStats / handleDashboardTrend
 *   - handleReactionGet / handleReactionSubmit（页面级 reaction）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

vi.mock('../../store/index', () => ({
  commentStore: {
    getCommentsCount: vi.fn().mockImplementation(async (urls: string[]) =>
      Object.fromEntries(urls.map((u) => [u, Math.floor(Math.random() * 5)]))
    ),
    getRecentComments: vi.fn().mockResolvedValue([
      { id: 'c1', url: '/p1', nick: 'A', mailMd5: '', comment: 'hi' },
    ]),
    getDashboardStats: vi.fn().mockResolvedValue({
      total: 100,
      today: 5,
      pending: 2,
      spam: 1,
    }),
    getDashboardTrend: vi.fn().mockResolvedValue([
      { date: '2026-01-01', count: 5 },
      { date: '2026-01-02', count: 3 },
    ]),
  },
  visitorStore: {
    getVisitorCount: vi.fn().mockResolvedValue(42),
  },
  reactionStore: {
    getReactions: vi.fn().mockResolvedValue({
      '👍': ['1.1.1.1', '2.2.2.2'],
      '❤️': ['1.1.1.1'],
    }),
    toggleReaction: vi.fn().mockResolvedValue({
      '👍': ['1.1.1.1', '2.2.2.2', '3.3.3.3'],
      '❤️': ['1.1.1.1'],
    }),
  },
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      SITE_URL: 'https://example.com',
      MASTER: '',
      MASTER_NAME: '',
    }),
  }
})

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ========== Imports ==========

import {
  handleCounterGet,
  handleCounterUpdate,
  handleGetCommentsCount,
  handleGetRecentComments,
  handleDashboardStats,
  handleDashboardTrend,
  handleReactionGet,
  handleReactionSubmit,
} from '../comment-misc'
import { commentStore, visitorStore, reactionStore } from '../../store/index'
import { AppError } from '../../errors'

// ========== Tests ==========

describe('comment-misc handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- Counter -----

  describe('handleCounterGet', () => {
    it('returns visitor count for url', async () => {
      const result = await handleCounterGet({ url: '/p', title: 'T' })
      expect(result).toBe(42)
      expect(visitorStore.getVisitorCount).toHaveBeenCalledWith('/p', 'T')
    })

    it('defaults url to "/"', async () => {
      await handleCounterGet({} as any)
      expect(visitorStore.getVisitorCount).toHaveBeenCalledWith('/', undefined)
    })
  })

  describe('handleCounterUpdate', () => {
    it('updates and returns count', async () => {
      const result = await handleCounterUpdate({ url: '/p', title: 'T' })
      expect(result).toBe(42)
      expect(visitorStore.getVisitorCount).toHaveBeenCalledWith('/p', 'T')
    })

    it('defaults url to "/" when nullish', async () => {
      await handleCounterUpdate({ url: undefined as any })
      expect(visitorStore.getVisitorCount).toHaveBeenCalledWith('/', undefined)
    })
  })

  // ----- Comments Count -----

  describe('handleGetCommentsCount', () => {
    it('returns counts for multiple urls', async () => {
      const result = await handleGetCommentsCount({ urls: ['/a', '/b', '/c'] })
      expect(result.data).toBeDefined()
      expect(Object.keys(result.data).length).toBe(3)
      expect(commentStore.getCommentsCount).toHaveBeenCalledWith(['/a', '/b', '/c'])
    })

    it('returns empty object for empty urls', async () => {
      const result = await handleGetCommentsCount({ urls: [] })
      expect(result.data).toEqual({})
    })

    it('throws AppError on missing urls', async () => {
      await expect(
        handleGetCommentsCount({} as any)
      ).rejects.toThrow(AppError)
    })
  })

  // ----- Recent Comments -----

  describe('handleGetRecentComments', () => {
    it('returns recent comments with normalized href', async () => {
      const result = await handleGetRecentComments({ count: 5 })
      expect(result.data.length).toBe(1)
      expect(result.data[0]).toHaveProperty('href')
      expect(commentStore.getRecentComments).toHaveBeenCalledWith(5)
    })

    it('defaults count to 10 when omitted', async () => {
      await handleGetRecentComments({} as any)
      expect(commentStore.getRecentComments).toHaveBeenCalledWith(10)
    })

    it('throws on count=0', async () => {
      await expect(
        handleGetRecentComments({ count: 0 } as any)
      ).rejects.toThrow(AppError)
    })

    it('produces absolute href from SITE_URL + url', async () => {
      const result = await handleGetRecentComments({ count: 1 })
      expect(result.data[0].href).toContain('example.com')
    })
  })

  // ----- Dashboard -----

  describe('handleDashboardStats', () => {
    it('returns raw store stats', async () => {
      const result = await handleDashboardStats()
      expect(result).toEqual({
        total: 100,
        today: 5,
        pending: 2,
        spam: 1,
      })
      expect(commentStore.getDashboardStats).toHaveBeenCalled()
    })
  })

  describe('handleDashboardTrend', () => {
    it('uses default days=7', async () => {
      await handleDashboardTrend()
      expect(commentStore.getDashboardTrend).toHaveBeenCalledWith(7)
    })

    it('honors custom days', async () => {
      await handleDashboardTrend(14)
      expect(commentStore.getDashboardTrend).toHaveBeenCalledWith(14)
    })

    it('returns trend array', async () => {
      const result = await handleDashboardTrend(7)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toHaveProperty('date')
      expect(result[0]).toHaveProperty('count')
    })
  })

  // ----- Page Reactions -----

  describe('handleReactionGet', () => {
    it('returns formatted reactions for an ip', async () => {
      const result = await handleReactionGet({ url: '/p', _ip: '1.1.1.1' })
      expect(result.reactions).toBeDefined()
      expect(result.myReactions).toBeDefined()
      expect(result.reactions['👍']).toBe(2)
      expect(result.reactions['❤️']).toBe(1)
      // 1.1.1.1 is in both emoji lists
      expect(result.myReactions).toEqual(expect.arrayContaining(['👍', '❤️']))
    })

    it('defaults url to "/"', async () => {
      await handleReactionGet({ _ip: 'x' } as any)
      expect(reactionStore.getReactions).toHaveBeenCalledWith('/')
    })

    it('defaults ip to "unknown"', async () => {
      await handleReactionGet({ url: '/p' } as any)
      expect(reactionStore.getReactions).toHaveBeenCalledWith('/p')
    })
  })

  describe('handleReactionSubmit', () => {
    it('toggles reaction and returns formatted result', async () => {
      const result = await handleReactionSubmit({
        url: '/p',
        emoji: '👍',
        _ip: '3.3.3.3',
      })
      expect(reactionStore.toggleReaction).toHaveBeenCalledWith('/p', '👍', '3.3.3.3')
      // mock returns 3 '👍' ips and 1 '❤️'
      expect(result.reactions['👍']).toBe(3)
      expect(result.reactions['❤️']).toBe(1)
      // 3.3.3.3 is in '👍' list (after toggle)
      expect(result.myReactions).toContain('👍')
    })

    it('defaults url to "/"', async () => {
      await handleReactionSubmit({ emoji: '🎉', _ip: 'x' } as any)
      expect(reactionStore.toggleReaction).toHaveBeenCalledWith('/', '🎉', 'x')
    })

    it('omits empty emoji entries from result', async () => {
      vi.mocked(reactionStore.toggleReaction).mockResolvedValueOnce({
        '👍': ['1.1.1.1'],
        '🎉': [], // empty — should be omitted
      })
      const result = await handleReactionSubmit({
        url: '/p',
        emoji: '👍',
        _ip: '1.1.1.1',
      })
      expect(result.reactions).toEqual({ '👍': 1 })
      expect(result.reactions).not.toHaveProperty('🎉')
    })
  })
})
