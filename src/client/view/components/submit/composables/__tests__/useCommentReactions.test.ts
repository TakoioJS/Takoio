/**
 * useCommentReactions 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCommentReactions } from '../useCommentReactions'

vi.mock('../../../../../utils', () => ({
  getCommentReactions: vi.fn(),
  toggleCommentReaction: vi.fn(),
}))

import { getCommentReactions, toggleCommentReaction as toggleApi } from '../../../../../utils'

describe('useCommentReactions', () => {
  const mockToast = vi.fn()
  const options = { envId: 'test-env', toast: mockToast }

  beforeEach(() => { vi.clearAllMocks() })

  it('fetchReactions gets reactions for a comment', async () => {
    vi.mocked(getCommentReactions).mockResolvedValueOnce({
      reactions: { like: 2 }, myReaction: 'like',
    })
    const { reactions, myReaction, fetchReactions } = useCommentReactions(options)
    await fetchReactions('comment-1')
    expect(reactions.value).toEqual({ like: 2 })
    expect(myReaction.value).toBe('like')
  })

  it('toggleReaction calls API and updates', async () => {
    vi.mocked(toggleApi).mockResolvedValueOnce({
      reactions: { heart: 1 }, myReaction: 'heart',
    })
    const { reactions, myReaction, toggleReaction } = useCommentReactions(options)
    await toggleReaction('comment-1', 'heart')
    expect(reactions.value).toEqual({ heart: 1 })
    expect(myReaction.value).toBe('heart')
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(toggleApi).mockRejectedValueOnce(new Error('fail'))
    const { toggleReaction } = useCommentReactions(options)
    await expect(toggleReaction('c1', 'like')).resolves.toBeUndefined()
    expect(mockToast).toHaveBeenCalled()
  })
})