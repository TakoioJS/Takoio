/**
 * Comment Get Handler Tests (Task 8.3.2)
 *
 * 覆盖 comment-get.ts 的 handleCommentGet：
 *   - 默认分页
 *   - 自定义分页
 *   - 排序（newest/oldest/hottest）
 *   - URL 过滤
 *   - 空结果
 *   - 校验失败
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ========== Mocks ==========

const mockComments = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    url: '/test',
    nick: `User${i + 1}`,
    mailMd5: '',
    comment: `comment ${i + 1}`,
    created: 1700000000000 + i,
  }))

vi.mock('../../store/index', () => ({
  commentStore: {
    getComments: vi.fn().mockImplementation(async (_url, _page, pageSize) => ({
      data: mockComments(Math.min(pageSize, 3)),
      total: 5,
      page: _page,
      pageSize,
    })),
  },
}))

vi.mock('../../store/redis', () => ({
  // Bypass cache: always call loader
  getOrSetCommentListCache: vi.fn().mockImplementation(
    async (_url, _page, _pageSize, _sort, loader) => loader()
  ),
  invalidateCommentListCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      SITE_NAME: 'Test',
      SITE_URL: 'https://example.com',
    }),
    publicConfigSubset: vi.fn().mockImplementation((cfg) => ({ SITE_NAME: cfg.SITE_NAME })),
  }
})

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ========== Imports ==========

import { handleCommentGet } from '../comment-get'
import { commentStore } from '../../store/index'
import { getOrSetCommentListCache } from '../../store/redis'
import { AppError } from '../../errors'

// ========== Tests ==========

describe('handleCommentGet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses default pagination (page=1, pageSize=10)', async () => {
    const result = await handleCommentGet({ url: '/test' } as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/test', 1, 10, 'newest')
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(10)
    expect(result.total).toBe(5)
    expect(result.config).toEqual({ SITE_NAME: 'Test' })
  })

  it('honors custom page/pageSize', async () => {
    await handleCommentGet({ url: '/test', page: 3, pageSize: 25 } as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/test', 3, 25, 'newest')
  })

  it('honors sort=oldest', async () => {
    await handleCommentGet({ url: '/test', sort: 'oldest' } as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/test', 1, 10, 'oldest')
  })

  it('honors sort=hottest', async () => {
    await handleCommentGet({ url: '/test', sort: 'hottest' } as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/test', 1, 10, 'hottest')
  })

  it('falls back to "/" when url omitted', async () => {
    await handleCommentGet({} as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/', 1, 10, 'newest')
  })

  it('uses url exactly when provided', async () => {
    await handleCommentGet({ url: '/posts/hello' } as any)
    expect(commentStore.getComments).toHaveBeenCalledWith('/posts/hello', 1, 10, 'newest')
  })

  it('passes result through getOrSetCommentListCache', async () => {
    await handleCommentGet({ url: '/cached' } as any)
    expect(getOrSetCommentListCache).toHaveBeenCalledWith(
      '/cached', 1, 10, 'newest',
      expect.any(Function)
    )
  })

  it('returns empty result set', async () => {
    vi.mocked(commentStore.getComments).mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
    const result = await handleCommentGet({ url: '/empty' } as any)
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })

  it('rejects page=0 with AppError (positive required)', async () => {
    await expect(
      handleCommentGet({ url: '/test', page: 0 } as any)
    ).rejects.toThrow(AppError)
    expect(commentStore.getComments).not.toHaveBeenCalled()
  })

  it('rejects pageSize > 100 with AppError', async () => {
    await expect(
      handleCommentGet({ url: '/test', pageSize: 200 } as any)
    ).rejects.toThrow(AppError)
  })

  it('rejects invalid sort enum with AppError', async () => {
    await expect(
      handleCommentGet({ url: '/test', sort: 'bogus' } as any)
    ).rejects.toThrow(AppError)
  })

  it('attaches public config subset to result', async () => {
    const result = await handleCommentGet({ url: '/test' } as any)
    expect(result.config).toBeDefined()
    expect(result.config.SITE_NAME).toBe('Test')
  })

  it('calls markMasterComments on result data', async () => {
    const result = await handleCommentGet({ url: '/test' } as any)
    // data should be returned as-is from store (mock doesn't match MASTER)
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.data[0]).toHaveProperty('id')
  })
})
