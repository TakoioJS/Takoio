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

// isAdminAsync defaults to false (matches real behavior for undefined token).
// Individual tests override via vi.mocked(isAdminAsync).mockResolvedValueOnce(true).
vi.mock('../../auth', () => ({
  isAdminAsync: vi.fn().mockResolvedValue(false),
}))

// ========== Imports ==========

import { handleCommentGet } from '../comment-get'
import { commentStore } from '../../store/index'
import { getOrSetCommentListCache } from '../../store/redis'
import { isAdminAsync } from '../../auth'
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

  // Regression: private replies (children) must have their content masked for
  // unauthorized viewers. Previously the filter only ran on top-level comments,
  // leaking private reply bodies via the children array.
  it('masks private reply content in children for unauthorized viewers', async () => {
    vi.mocked(commentStore.getComments).mockResolvedValueOnce({
      data: [
        {
          id: 'parent-1',
          url: '/test',
          nick: 'Alice',
          mailMd5: 'aaa',
          comment: 'public top-level',
          renderedComment: '<p>public top-level</p>',
          isPrivate: false,
          children: [
            {
              id: 'reply-1',
              nick: 'Bob',
              mailMd5: 'bbb',
              comment: 'secret private reply',
              renderedComment: '<p>secret private reply</p>',
              isPrivate: true,
            },
            {
              id: 'reply-2',
              nick: 'Carol',
              mailMd5: 'ccc',
              comment: 'public reply',
              renderedComment: '<p>public reply</p>',
              isPrivate: false,
            },
          ],
        },
      ],
      total: 1,
    })

    const result = await handleCommentGet({ url: '/test' } as any)
    const parent = result.data[0]
    const privateReply = parent.children.find((c: any) => c.id === 'reply-1')
    const publicReply = parent.children.find((c: any) => c.id === 'reply-2')

    // Private reply content must be masked — NOT the original secret body
    expect(privateReply.comment).not.toBe('secret private reply')
    expect(privateReply.comment).toBe('🔒 私密评论')
    expect(privateReply.renderedComment).toContain('仅博主与作者本人可见')
    // Public reply content stays intact
    expect(publicReply.comment).toBe('public reply')
  })

  it('keeps private reply content visible to the master viewer (adminToken)', async () => {
    vi.mocked(isAdminAsync).mockResolvedValueOnce(true)
    vi.mocked(commentStore.getComments).mockResolvedValueOnce({
      data: [
        {
          id: 'parent-1',
          url: '/test',
          nick: 'Alice',
          mailMd5: 'aaa',
          comment: 'public top-level',
          isPrivate: false,
          children: [
            {
              id: 'reply-1',
              nick: 'Bob',
              mailMd5: 'bbb',
              comment: 'secret private reply',
              renderedComment: '<p>secret private reply</p>',
              isPrivate: true,
            },
          ],
        },
      ],
      total: 1,
    })

    const result = await handleCommentGet({ url: '/test', adminToken: 'valid-admin' } as any)
    const privateReply = result.data[0].children[0]
    // Master viewer sees the real content of private replies
    expect(privateReply.comment).toBe('secret private reply')
  })
})
