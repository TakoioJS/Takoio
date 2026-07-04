/**
 * useReactions 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReactions } from '../useReactions'

vi.mock('../../../../../utils', () => ({
  getReactions: vi.fn(),
  toggleReaction: vi.fn(),
}))

import { getReactions, toggleReaction as toggleReactionApi } from '../../../../../utils'

describe('useReactions', () => {
  const mockToast = vi.fn()
  const options = { options: { envId: 'test-env' } as any, toast: mockToast }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchReactions gets reactions from API', async () => {
    vi.mocked(getReactions).mockResolvedValueOnce({
      reactions: { like: 5, heart: 3 },
      myReactions: ['like'],
    })
    const { reactions, myReactions, fetchReactions } = useReactions(options)
    await fetchReactions()
    expect(reactions.value).toEqual({ like: 5, heart: 3 })
    expect(myReactions.value).toEqual(['like'])
  })

  it('toggleReaction calls API and updates state', async () => {
    vi.mocked(toggleReactionApi).mockResolvedValueOnce({
      reactions: { like: 6 },
      myReactions: ['like'],
    })
    const { reactions, myReactions, toggleReaction } = useReactions(options)
    await toggleReaction('like')
    expect(reactions.value).toEqual({ like: 6 })
    expect(myReactions.value).toEqual(['like'])
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(toggleReactionApi).mockRejectedValueOnce(new Error('network'))
    const { toggleReaction } = useReactions(options)
    await expect(toggleReaction('👍')).resolves.toBeUndefined()
    expect(mockToast).toHaveBeenCalled()
  })
})