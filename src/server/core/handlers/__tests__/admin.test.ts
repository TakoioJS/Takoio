/**
 * Admin Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../store/index', () => ({
  configStore: {
    getConfig: vi.fn().mockResolvedValue({}),
    setConfig: vi.fn().mockResolvedValue(undefined),
    setManyConfig: vi.fn().mockResolvedValue(undefined),
    resetConfig: vi.fn().mockResolvedValue(undefined),
  },
  sessionStore: {
    createToken: vi.fn().mockResolvedValue('test-token'),
    validateToken: vi.fn().mockResolvedValue(true),
    removeToken: vi.fn().mockResolvedValue(undefined),
    removeAllTokens: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../config', () => ({
  getConfig: vi.fn().mockResolvedValue({
    SITE_NAME: 'Test Blog',
    SMTP_HOST: 'smtp.test.com',
    SMTP_PASS: 'secret123',
  }),
  maskSensitiveConfig: vi.fn().mockImplementation((cfg) => cfg),
  DEFAULT_CONFIG: {
    SITE_NAME: 'My Blog',
  },
  ALLOWED_CONFIG_KEYS: ['SITE_NAME', 'SMTP_PASS'],
  SENSITIVE_CONFIG_KEYS: new Set(['SMTP_PASS']),
  invalidateConfig: vi.fn(),
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode = 400) {
      super(message)
      this.name = 'AppError'
    }
  },
}))

vi.mock('../../auth', () => ({
  getAuthHash: vi.fn().mockResolvedValue('hashed-password'),
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  updateAuthHashCache: vi.fn(),
  invalidateAuthHashCache: vi.fn(),
  checkLoginRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  recordLoginFailure: vi.fn().mockResolvedValue(undefined),
  clearLoginFailures: vi.fn().mockResolvedValue(undefined),
  verifyCaptcha: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../utils/crypto', () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  needsRehash: vi.fn().mockReturnValue(false),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, message: 'sent' }),
}))

vi.mock('../../notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../env', () => ({
  isDev: vi.fn().mockReturnValue(true),
  SETUP_TOKEN: undefined,
}))

vi.mock('../../ip-region', () => ({
  lookupIpRegion: vi.fn().mockResolvedValue('CN'),
}))

vi.mock('../../store/index', async () => {
  const actual = await vi.importActual('../../store/index')
  return {
    ...actual,
    commentStore: {
      getComment: vi.fn().mockResolvedValue({ id: '1', url: '/test', ip: '127.0.0.1' }),
      setCommentIpRegion: vi.fn().mockResolvedValue(true),
    },
  }
})

import {
  handleCheckSetup,
  handleLogin,
  handleLogout,
  handleGetConfig,
  handleSetConfig,
  handlePasswordSet,
  handleIpRegionGet,
} from '../admin'

describe('Admin Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleCheckSetup', () => {
    it('returns setup status', async () => {
      const result = await handleCheckSetup()
      expect(result).toHaveProperty('needSetup')
      expect(result).toHaveProperty('setupTokenRequired')
      expect(result).toHaveProperty('dev')
    })
  })

  describe('handleLogin', () => {
    it('returns token on successful login', async () => {
      const result = await handleLogin(
        { password: 'correct-password' },
        '127.0.0.1'
      )
      expect(result.success).toBe(true)
      expect(result.token).toBe('test-token')
    })

    it('returns error on wrong password', async () => {
      const { verifyPassword } = await import('../../utils/crypto')
      vi.mocked(verifyPassword).mockResolvedValueOnce(false)

      const result = await handleLogin(
        { password: 'wrong-password' },
        '127.0.0.1'
      )
      expect(result.success).toBe(false)
      expect(result.message).toBe('密码错误')
    })

    it('blocks when rate limited', async () => {
      const { checkLoginRateLimit } = await import('../../auth')
      vi.mocked(checkLoginRateLimit).mockResolvedValueOnce({ allowed: false })

      const result = await handleLogin(
        { password: 'correct-password' },
        '127.0.0.1'
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('频繁')
    })
  })

  describe('handleLogout', () => {
    it('removes token and returns success', async () => {
      const { sessionStore } = await import('../../store/index')
      const result = await handleLogout({ token: 'test-token' })
      expect(result.success).toBe(true)
      expect(sessionStore.removeToken).toHaveBeenCalledWith('test-token')
    })
  })

  describe('handleGetConfig', () => {
    it('returns masked config', async () => {
      const result = await handleGetConfig()
      expect(result.data).toBeDefined()
    })
  })

  describe('handleSetConfig', () => {
    it('filters and sets allowed config', async () => {
      const { configStore } = await import('../../store/index')
      const result = await handleSetConfig({
        config: {
          SITE_NAME: 'New Name',
        },
      })
      expect(result.success).toBe(true)
      expect(configStore.setManyConfig).toHaveBeenCalled()
    })

    it('rejects masked values for sensitive keys', async () => {
      const { configStore } = await import('../../store/index')
      await handleSetConfig({
        config: {
          SMTP_PASS: 'my****pass',
        },
      })
      const callArgs = vi.mocked(configStore.setManyConfig).mock.calls[0][0]
      expect(callArgs.SMTP_PASS).toBeUndefined()
    })
  })

  describe('handlePasswordSet', () => {
    it('sets password with valid setup token', async () => {
      const { getAuthHash } = await import('../../auth')
      vi.mocked(getAuthHash).mockResolvedValueOnce(null) // No existing password

      const result = await handlePasswordSet({
        password: 'new-password-123',
        setupToken: 'test-setup-token',
      })
      expect(result.success).toBe(true)
      expect(result.token).toBe('test-token')
    })
  })

  describe('handleIpRegionGet', () => {
    it('returns IP region for comment', async () => {
      const result = await handleIpRegionGet({ id: '1' })
      expect(result.ipRegion).toBe('CN')
    })
  })
})
