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

  it('truncates long comments', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      comment: 'x'.repeat(501),
      _ip: '127.0.0.1',
    })
    // Long comments are truncated at handler level, not rejected
    expect(result.data.comment.length).toBeLessThanOrEqual(500)
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

  it('does not crash when MASTER_NAME / MASTER are numeric (regression: config type-coercion TypeError)', async () => {
    // config 存储层把字符串原样写入、读取时统一 JSON.parse：当博主把 MASTER_NAME
    // 设成全数字字符串 "12345" 时，读回的是 number 12345。旧实现直接调用
    // (12345).toLowerCase() 会抛 TypeError，导致所有评论提交失败。
    const { getConfig } = await import('../../config')
    vi.mocked(getConfig).mockResolvedValueOnce({
      SITE_NAME: 'Test Blog',
      MASTER_NAME: 12345 as unknown as string, // 模拟 JSON.parse 把 "12345" 解成 number
      MASTER: 67890 as unknown as string,
      ENABLE_CAPTCHA: false,
      COMMENT_RATE_LIMIT: 30000,
      COMMENT_LENGTH_MAX: 500,
      BLOCKED_KEYWORDS: 'spam,gambling',
      AUTO_AUDIT_METHOD: '',
      AUDIT_MODE: false,
      ENABLE_MAIL_NOTIFICATION: false,
    } as any)

    // 不应抛出 TypeError；正常提交应成功
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      mail: 'test@example.com',
      comment: 'This is a test comment',
      _ip: '127.0.0.1',
    })
    expect(result.data).toBeDefined()
    expect(result.data.nick).toBe('TestUser')
  })
})
