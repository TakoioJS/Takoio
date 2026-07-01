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

vi.mock('../../config', () => ({
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
    constructor(public code: string, message: string, public statusCode = 400) {
      super(message)
      this.name = 'AppError'
    }
  },
}))

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
    ).rejects.toThrow('输入验证失败')
  })

  it('rejects comment exceeding max length', async () => {
    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'TestUser',
        comment: 'x'.repeat(501),
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow('输入验证失败')
  })

  it('rejects impersonation of master', async () => {
    const { requireAdmin } = await import('../../auth')

    await expect(
      handleCommentSubmit({
        url: '/test',
        nick: 'Admin',
        comment: 'Impersonating admin',
        _ip: '127.0.0.1',
      })
    ).rejects.toThrow('Unauthorized')

    expect(requireAdmin).toHaveBeenCalled()
  })

  it('truncates nick to 50 chars', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'A'.repeat(100),
      comment: 'Test comment',
      _ip: '127.0.0.1',
    })

    expect(result.data.nick.length).toBe(50)
  })

  it('generates mailMd5 hash for email', async () => {
    const result = await handleCommentSubmit({
      url: '/test',
      nick: 'TestUser',
      mail: 'test@example.com',
      comment: 'Test comment',
      _ip: '127.0.0.1',
    })

    expect(result.data.mailMd5).toBeDefined()
    expect(result.data.mailMd5).not.toBe('')
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
    expect(result.data.ipRegion).toBeNull()
  })
})
