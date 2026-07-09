/**
 * Admin Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config', async () => {
  const actual = await vi.importActual('../../config')
  return {
    ...actual,
    getConfig: vi.fn().mockResolvedValue({
      SITE_NAME: 'Test Blog',
      SMTP_HOST: 'smtp.test.com',
      SMTP_PASS: 'test-smtp-pass-123',
    }),
    maskSensitiveConfig: vi.fn().mockImplementation((cfg) => cfg),
    invalidateConfig: vi.fn(),
    AppError: class AppError extends Error {
      constructor (public code: string, message: string, public statusCode = 400) {
        super(message)
        this.name = 'AppError'
      }
    },
  }
})

vi.mock('../../auth', () => ({
  getAuthHash: vi.fn().mockResolvedValue('hashed-password'),
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  updateAuthHashCache: vi.fn(),
  invalidateAuthHashCache: vi.fn(),
  invalidateAdminTokenCache: vi.fn(),
  requireAdmin: vi.fn().mockResolvedValue(undefined),
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
    rateLimitStore: {
      checkRateLimit: vi.fn().mockResolvedValue(true),
    },
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
  handleConfigReset,
  handleIpRegionGet,
} from '../admin'

describe('Admin Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleCheckSetup', () => {
    it('returns setup status without dev flag', async () => {
      const result = await handleCheckSetup()
      expect(result).toHaveProperty('needSetup')
      expect(result).toHaveProperty('setupTokenRequired')
      expect(result).not.toHaveProperty('dev')
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
      vi.mocked(checkLoginRateLimit).mockResolvedValueOnce({ allowed: false, remainingAttempts: 0 })

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

    it('invalidates admin token cache for the logged-out token (regression: post-logout auth bypass)', async () => {
      // 旧实现只调用 sessionStore.removeToken，未失效 _adminTokenCache（60s TTL），
      // 导致登出后 60s 内旧 token 仍能通过 isAdminAsync 校验，构成鉴权绕过。
      const { invalidateAdminTokenCache } = await import('../../auth')
      await handleLogout({ token: 'leaked-token' })
      expect(invalidateAdminTokenCache).toHaveBeenCalledWith('leaked-token')
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

    it('clears admin token cache after password change (regression: post-change auth bypass)', async () => {
      // 改密会调用 sessionStore.removeAllTokens 让所有旧 session 失效，
      // 但 _adminTokenCache（60s TTL）仍可能放行旧 token，导致改密后 60s 鉴权绕过。
      const { getAuthHash, invalidateAdminTokenCache } = await import('../../auth')
      vi.mocked(getAuthHash).mockResolvedValueOnce(null)
      await handlePasswordSet({ password: 'new-password-123', setupToken: 'test-setup-token' })
      expect(invalidateAdminTokenCache).toHaveBeenCalledWith()
    })
  })

  describe('handleConfigReset', () => {
    it('clears admin token cache after config reset (regression: post-reset auth bypass)', async () => {
      // 重置配置会清除 AUTH_HASH 并 removeAllTokens，但 _adminTokenCache（60s TTL）
      // 仍可能放行旧 token，构成重置后 60s 内的鉴权绕过。
      const { invalidateAdminTokenCache } = await import('../../auth')
      await handleConfigReset()
      expect(invalidateAdminTokenCache).toHaveBeenCalledWith()
    })
  })

  describe('handleIpRegionGet', () => {
    it('returns IP region for comment', async () => {
      const result = await handleIpRegionGet({ id: '1' })
      expect(result.ipRegion).toBe('CN')
    })
  })
})
