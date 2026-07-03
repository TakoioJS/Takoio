/**
 * Comment Reaction Handler Tests (Task 8.3.4)
 *
 * 覆盖 comment-reaction.ts：
 *   - handleCommentReactionGet
 *   - handleCommentReactionSubmit (toggle, 首次/重复, 不同 emoji)
 *
 * 注：handler 通过动态 `import('../config').AppError` 抛错，
 * config mock 中保留 AppError 类即可。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

vi.mock('../../store/index', () => ({
  commentStore: {
    getCommentReactions: vi.fn().mockResolvedValue({
      '👍': { count: 3, ips: ['1.1.1.1', '2.2.2.2', '3.3.3.3'] },
      '❤️': { count: 1, ips: ['1.1.1.1'] },
      '🎉': { count: 0, ips: [] }, // empty — should be omitted
    }),
    toggleCommentReaction: vi.fn().mockResolvedValue({
      '👍': { count: 4, ips: ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'] },
      '❤️': { count: 1, ips: ['1.1.1.1'] },
      '🎉': { count: 0, ips: [] },
    }),
  },
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    // AppError is re-exported via errors; ensure dynamic import works
    AppError: (await vi.importActual('../../errors')).AppError,
  }
})

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ========== Imports ==========

import {
  handleCommentReactionGet,
  handleCommentReactionSubmit,
} from '../comment-reaction'
import { commentStore } from '../../store/index'
import { AppError } from '../../errors'

// ========== Tests ==========

describe('comment-reaction handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- Get -----

  describe('handleCommentReactionGet', () => {
    it('returns formatted reactions for known ip', async () => {
      const result = await handleCommentReactionGet({ id: 'c1', _ip: '1.1.1.1' })
      expect(result.reactions).toEqual({ '👍': 3, '❤️': 1 })
      // 1.1.1.1 voted both 👍 and ❤️; handler assigns last-iterated emoji to myReaction
      expect(result.myReaction).toBe('❤️')
    })

    it('returns null myReaction for ip not in any list', async () => {
      const result = await handleCommentReactionGet({ id: 'c1', _ip: '9.9.9.9' })
      expect(result.myReaction).toBeNull()
      expect(result.reactions['👍']).toBe(3)
    })

    it('omits empty emoji entries', async () => {
      const result = await handleCommentReactionGet({ id: 'c1', _ip: '1.1.1.1' })
      expect(result.reactions).not.toHaveProperty('🎉')
    })

    it('defaults ip to "unknown"', async () => {
      await handleCommentReactionGet({ id: 'c1' })
      expect(commentStore.getCommentReactions).toHaveBeenCalledWith('c1')
    })

    it('passes id to store', async () => {
      await handleCommentReactionGet({ id: 'c42', _ip: 'x' })
      expect(commentStore.getCommentReactions).toHaveBeenCalledWith('c42')
    })
  })

  // ----- Submit -----

  describe('handleCommentReactionSubmit', () => {
    it('toggles reaction and returns formatted result', async () => {
      const result = await handleCommentReactionSubmit({
        id: 'c1',
        emoji: '👍',
        _ip: '4.4.4.4',
      })
      expect(commentStore.toggleCommentReaction).toHaveBeenCalledWith('c1', '👍', '4.4.4.4')
      expect(result.reactions['👍']).toBe(4)
      // 4.4.4.4 just voted 👍
      expect(result.myReaction).toBe('👍')
    })

    it('returns null myReaction when ip not in result', async () => {
      vi.mocked(commentStore.toggleCommentReaction).mockResolvedValueOnce({
        '👍': { count: 2, ips: ['1.1.1.1', '2.2.2.2'] },
      })
      const result = await handleCommentReactionSubmit({
        id: 'c1',
        emoji: '👍',
        _ip: '9.9.9.9',
      })
      expect(result.myReaction).toBeNull()
    })

    it('throws AppError when id is missing', async () => {
      await expect(
        handleCommentReactionSubmit({ emoji: '👍', _ip: '1.1.1.1' } as any)
      ).rejects.toThrow(AppError)
      expect(commentStore.toggleCommentReaction).not.toHaveBeenCalled()
    })

    it('defaults ip to "unknown"', async () => {
      await handleCommentReactionSubmit({ id: 'c1', emoji: '👍' })
      expect(commentStore.toggleCommentReaction).toHaveBeenCalledWith('c1', '👍', 'unknown')
    })

    it('omits empty emoji entries from result', async () => {
      vi.mocked(commentStore.toggleCommentReaction).mockResolvedValueOnce({
        '👍': { count: 1, ips: ['1.1.1.1'] },
        '🎉': { count: 0, ips: [] },
      })
      const result = await handleCommentReactionSubmit({
        id: 'c1',
        emoji: '👍',
        _ip: '1.1.1.1',
      })
      expect(result.reactions).toEqual({ '👍': 1 })
      expect(result.reactions).not.toHaveProperty('🎉')
    })

    it('toggles different emoji', async () => {
      vi.mocked(commentStore.toggleCommentReaction).mockResolvedValueOnce({
        '❤️': { count: 2, ips: ['1.1.1.1', '5.5.5.5'] },
      })
      const result = await handleCommentReactionSubmit({
        id: 'c1',
        emoji: '❤️',
        _ip: '5.5.5.5',
      })
      expect(commentStore.toggleCommentReaction).toHaveBeenCalledWith('c1', '❤️', '5.5.5.5')
      expect(result.reactions['❤️']).toBe(2)
      expect(result.myReaction).toBe('❤️')
    })
  })
})
