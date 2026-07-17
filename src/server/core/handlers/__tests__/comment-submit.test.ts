/**
 * Comment Submit Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../../store/index', () => ({
  commentStore: {
    addComment: vi.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'test-id' })),
    getRawRecentComments: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      SITE_NAME: 'Test Blog',
      MASTER_NAME: 'Admin',
      MASTER: 'admin@test.com',
      ENABLE_CAPTCHA: false,
      COMMENT_RATE_LIMIT: 30000,
      COMMENT_LENGTH_MAX: 500,
      BLOCKED_KEYWORDS: 'spam,gambling',
      AUTO_AUDIT_METHOD: '',
      AUDIT_MODE: false,
      ENABLE_MAIL_NOTIFICATION: false,
    }),
    AppError: class AppError extends Error {
      constructor (public code: string, message: string, public statusCode = 400) {
        super(message)
        this.name = 'AppError'
      }
    },
  }
})

vi.mock('../../auth', () => ({
  verifyCaptcha: vi.fn().mockResolvedValue(true),
  requireAdmin: vi.fn().mockRejectedValue(new Error('Unauthorized')),
}))

vi.mock('../../moderate', () => ({
  moderateComment: vi.fn().mockResolvedValue({
    passed: true,
    spam: false,
    score: 0,
    reasons: [],
    source: 'none',
  }),
  getAuditAction: vi.fn().mockReturnValue('pass'),
}))

vi.mock('../../ip-region', () => ({
  lookupIpRegion: vi.fn().mockResolvedValue('CN'),
}))

vi.mock('../../utils/render', () => ({
  renderComment: vi.fn().mockResolvedValue('<p>Test comment</p>'),
}))

vi.mock('../../store/redis', () => ({
  invalidateCommentListCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../events', () => ({
  notifyComment: vi.fn(),
}))

vi.mock('../../notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { handleCommentSubmit } from '../comment-submit'

describe('handleCommentSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits a valid comment', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      mail: 'test@example.com',
      comment: 'This is a test comment',
      _ip: '127.0.0.1',
    })

    expect(result.data).toBeDefined()
    expect(result.data.nick).toBe('TestUser')
    expect(result.data.comment).toBe('This is a test comment')
    expect(result.moderated.passed).toBe(true)
  })

  it('rejects empty comment', async () => {
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'TestUser',
        comment: '',
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow()
  })

  it('rejects comments exceeding COMMENT_LENGTH_MAX instead of silently truncating', async () => {
    // 安全修复：原实现先通过 schema(max 5000) 再静默 slice 到 COMMENT_LENGTH_MAX(默认 500)，
    // 截断点可能落在 markdown 构造中间导致渲染产物破损，且用户内容无提示丢失。
    // 现超出 cfg.COMMENT_LENGTH_MAX 时直接 400 拒绝。
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'TestUser',
        comment: 'x'.repeat(501), // mock cfg.COMMENT_LENGTH_MAX = 500
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow(/超过/)
    // 等长上限的评论应被接受
    const ok = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      comment: 'x'.repeat(500),
      _ip: '127.0.0.1',
    })
    expect(ok.data.comment.length).toBe(500)
  })

  it('rejects impersonation of master', async () => {
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'Admin',
        comment: 'Impersonating admin',
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow('提交失败')
  })

  // Regress: case-variant email must not bypass impersonation check (SEC-001)
  it('blocks case-variant email impersonation', async () => {
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'not-admin',
        mail: 'Admin@Test.com', // case differs from cfg.MASTER 'admin@test.com'
        comment: 'Should be blocked by fix',
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow('提交失败')
  })

  it('rejects nick exceeding 50 chars', async () => {
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'A'.repeat(100),
        comment: 'Test comment',
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow()
  })

  it('generates SHA-256 mail hash for email', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      mail: 'test@example.com',
      comment: 'Test comment',
      _ip: '127.0.0.1',
    })

    expect(result.data.mailMd5).toBeDefined()
    expect(result.data.mailMd5).not.toBe('')
    // SHA-256 produces 64-character hex strings (vs MD5's 32)
    expect(result.data.mailMd5.length).toBe(64)
  })

  it('handles optional fields as null', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      comment: 'Test comment',
      _ip: '127.0.0.1',
    })

    expect(result.data.pid).toBeNull()
    expect(result.data.rid).toBeNull()
    expect(result.data.image).toBeNull()
    // ipRegion may be '' (empty string) or 'CN' (from mock) when lookup runs
    expect(result.data.ipRegion === null || result.data.ipRegion === '' || result.data.ipRegion === 'CN').toBe(true)
  })
})
