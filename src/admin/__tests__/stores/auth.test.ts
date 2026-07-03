// @vitest-environment jsdom
/**
 * Auth Pinia store tests (Task 8.5.1)
 *
 * 测试 `src/admin/stores/auth.ts` 的 login/logout/setup/checkSetup/token 持久化。
 *
 * 隔离策略：
 * - mock `@takoio/common` 的 t 函数（返回 key 字符串便于断言）
 * - mock `../../api/client` 的 api.get/post/put/delete
 * - 用 createPinia() + setActivePinia() 设置测试用 pinia
 * - 用 jsdom 环境提供 localStorage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ---------- mock @takoio/common ----------
vi.mock('@takoio/common', () => ({
  t: vi.fn((key: string) => key),
  setLanguage: vi.fn(),
}))

// ---------- mock api/client ----------
const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('../../api/client', () => ({
  api: apiMocks,
}))

import { useAuthStore } from '../../stores/auth'

const SESSION_KEY = 'takoio-admin-session'
const OLD_SESSION_KEY = 'twikoo-admin-session'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})

// =================================================================
// checkSetup
// =================================================================
describe('checkSetup', () => {
  it('returns true and sets needSetup when API returns needSetup=true', async () => {
    apiMocks.get.mockResolvedValueOnce({
      needSetup: true,
      dev: true,
      setupTokenRequired: true,
    })

    const store = useAuthStore()
    const result = await store.checkSetup()

    expect(result).toBe(true)
    expect(store.needSetup).toBe(true)
    expect(store.setupDev).toBe(true)
    expect(store.setupTokenRequired).toBe(true)
    expect(apiMocks.get).toHaveBeenCalledWith('/api/admin/setup')
  })

  it('returns false when API returns needSetup=false', async () => {
    apiMocks.get.mockResolvedValueOnce({ needSetup: false })

    const store = useAuthStore()
    const result = await store.checkSetup()

    expect(result).toBe(false)
    expect(store.needSetup).toBe(false)
  })

  it('returns false on API error (silent catch)', async () => {
    apiMocks.get.mockRejectedValueOnce(new Error('network'))

    const store = useAuthStore()
    const result = await store.checkSetup()

    expect(result).toBe(false)
    expect(store.needSetup).toBe(false)
  })
})

// =================================================================
// login
// =================================================================
describe('login', () => {
  it('stores token and sets isAuthenticated on success', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true, token: 'jwt-token-123' })

    const store = useAuthStore()
    const result = await store.login('correct-password')

    expect(result.success).toBe(true)
    expect(store.token).toBe('jwt-token-123')
    expect(store.isAuthenticated).toBe(true)
    expect(apiMocks.post).toHaveBeenCalledWith('/api/admin/login', {
      password: 'correct-password',
      captchaToken: undefined,
    })
  })

  it('persists session to localStorage with 24h expiry when remember=true', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true, token: 'persisted-token' })

    const store = useAuthStore()
    await store.login('pwd', true)

    const saved = localStorage.getItem(SESSION_KEY)
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed.token).toBe('persisted-token')
    expect(parsed.expires).toBeGreaterThan(Date.now())
    // 24h expiry
    expect(parsed.expires - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
    expect(parsed.expires - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000)
  })

  it('does NOT persist to localStorage when remember=false', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true, token: 'session-only' })

    const store = useAuthStore()
    await store.login('pwd', false)

    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    // But token is still set in-memory
    expect(store.token).toBe('session-only')
    expect(store.isAuthenticated).toBe(true)
  })

  it('forwards captchaToken to API', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true, token: 'tok' })

    const store = useAuthStore()
    await store.login('pwd', false, 'captcha-xyz')

    expect(apiMocks.post).toHaveBeenCalledWith('/api/admin/login', {
      password: 'pwd',
      captchaToken: 'captcha-xyz',
    })
  })

  it('returns {success:false, message:"needSetup"} when API returns needSetup=true', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: false, needSetup: true })

    const store = useAuthStore()
    const result = await store.login('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('needSetup')
    expect(store.needSetup).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })

  it('returns i18n loginFailed message when API returns success=false without needSetup', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: false, message: '密码错误' })

    const store = useAuthStore()
    const result = await store.login('wrong-pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('密码错误')
  })

  it('falls back to t("loginFailed") when API returns no message', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: false })

    const store = useAuthStore()
    const result = await store.login('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('loginFailed')
  })

  it('catches network error and returns i18n message', async () => {
    apiMocks.post.mockRejectedValueOnce(new Error('Network down'))

    const store = useAuthStore()
    const result = await store.login('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Network down')
  })

  it('handles non-Error thrown value (string)', async () => {
    apiMocks.post.mockRejectedValueOnce('string-error')

    const store = useAuthStore()
    const result = await store.login('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('string-error')
  })
})

// =================================================================
// logout
// =================================================================
describe('logout', () => {
  it('clears token and isAuthenticated state', async () => {
    apiMocks.post.mockResolvedValueOnce({})

    const store = useAuthStore()
    store.token = 'some-token'
    store.isAuthenticated = true

    await store.logout()

    expect(store.token).toBe('')
    expect(store.isAuthenticated).toBe(false)
    expect(apiMocks.post).toHaveBeenCalledWith('/api/admin/logout')
  })

  it('clears localStorage session', async () => {
    apiMocks.post.mockResolvedValueOnce({})
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'tok', expires: Date.now() + 99999 }))

    const store = useAuthStore()
    await store.logout()

    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('still clears state even when API call fails (silent)', async () => {
    apiMocks.post.mockRejectedValueOnce(new Error('network'))

    const store = useAuthStore()
    store.token = 'tok'
    store.isAuthenticated = true

    await store.logout()

    expect(store.token).toBe('')
    expect(store.isAuthenticated).toBe(false)
  })

  it('stops the refresh timer', async () => {
    apiMocks.post.mockResolvedValueOnce({})
    const stopSpy = vi.spyOn(useAuthStore(), '_stopRefresh')

    const store = useAuthStore()
    await store.logout()

    expect(stopSpy).toHaveBeenCalled()
    expect(store._refreshTimer).toBeNull()
  })
})

// =================================================================
// setup
// =================================================================
describe('setup', () => {
  it('sets password and stores token on success', async () => {
    apiMocks.put.mockResolvedValueOnce({ success: true, token: 'setup-token' })

    const store = useAuthStore()
    store.needSetup = true
    const result = await store.setup('new-password-123')

    expect(result.success).toBe(true)
    expect(store.token).toBe('setup-token')
    expect(store.isAuthenticated).toBe(true)
    expect(store.needSetup).toBe(false)
    expect(apiMocks.put).toHaveBeenCalledWith('/api/admin/password', {
      password: 'new-password-123',
    })
  })

  it('forwards setupToken when provided', async () => {
    apiMocks.put.mockResolvedValueOnce({ success: true, token: 'tok' })

    const store = useAuthStore()
    await store.setup('pwd', 'setup-token-abc')

    expect(apiMocks.put).toHaveBeenCalledWith('/api/admin/password', {
      password: 'pwd',
      setupToken: 'setup-token-abc',
    })
  })

  it('returns error message on failure', async () => {
    apiMocks.put.mockResolvedValueOnce({ success: false, message: 'Token 无效' })

    const store = useAuthStore()
    const result = await store.setup('pwd', 'bad-token')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Token 无效')
  })

  it('falls back to t("setupFailed") when API returns no message', async () => {
    apiMocks.put.mockResolvedValueOnce({ success: false })

    const store = useAuthStore()
    const result = await store.setup('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('setupFailed')
  })

  it('catches network error and returns i18n message', async () => {
    apiMocks.put.mockRejectedValueOnce(new Error('connection refused'))

    const store = useAuthStore()
    const result = await store.setup('pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('connection refused')
  })
})

// =================================================================
// restoreSession
// =================================================================
describe('restoreSession', () => {
  it('restores valid session from localStorage', () => {
    const futureExpiry = Date.now() + 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'restored-token', expires: futureExpiry }))

    const store = useAuthStore()
    const result = store.restoreSession()

    expect(result).toBe(true)
    expect(store.token).toBe('restored-token')
    expect(store.isAuthenticated).toBe(true)
  })

  it('returns false when no session in localStorage', () => {
    const store = useAuthStore()
    const result = store.restoreSession()

    expect(result).toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })

  it('removes expired session from localStorage', () => {
    const pastExpiry = Date.now() - 1000
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'expired', expires: pastExpiry }))

    const store = useAuthStore()
    const result = store.restoreSession()

    expect(result).toBe(false)
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('handles corrupted JSON in localStorage (silent catch)', () => {
    localStorage.setItem(SESSION_KEY, 'not valid json {{{')

    const store = useAuthStore()
    const result = store.restoreSession()

    expect(result).toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })

  it('migrates session from old (twikoo) key to new key when new key is missing', () => {
    const futureExpiry = Date.now() + 60 * 60 * 1000
    const oldData = JSON.stringify({ token: 'old-key-token', expires: futureExpiry })
    localStorage.setItem(OLD_SESSION_KEY, oldData)

    const store = useAuthStore()
    const result = store.restoreSession()

    expect(result).toBe(true)
    expect(store.token).toBe('old-key-token')
    // old key 应被删除
    expect(localStorage.getItem(OLD_SESSION_KEY)).toBeNull()
    // new key 应该接收数据
    expect(localStorage.getItem(SESSION_KEY)).toBe(oldData)
  })

  it('starts refresh timer when session is restored', () => {
    const futureExpiry = Date.now() + 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'tok', expires: futureExpiry }))

    const store = useAuthStore()
    store.restoreSession()

    expect(store._refreshTimer).not.toBeNull()
  })
})

// =================================================================
// changePassword
// =================================================================
describe('changePassword', () => {
  it('verifies old password then sets new one, saving returned token', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true }) // verify old
    apiMocks.put.mockResolvedValueOnce({ success: true, token: 'rotated-token' }) // set new

    const store = useAuthStore()
    const result = await store.changePassword('old-pwd', 'new-pwd-123')

    expect(result.success).toBe(true)
    expect(store.token).toBe('rotated-token')
    expect(apiMocks.post).toHaveBeenCalledWith('/api/admin/login', { password: 'old-pwd' })
    expect(apiMocks.put).toHaveBeenCalledWith('/api/admin/password', { password: 'new-pwd-123' })
  })

  it('returns t("oldPasswordFailed") when old password verification fails', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: false })

    const store = useAuthStore()
    const result = await store.changePassword('wrong-old', 'new-pwd')

    expect(result.success).toBe(false)
    expect(result.message).toBe('oldPasswordFailed')
    expect(apiMocks.put).not.toHaveBeenCalled()
  })

  it('returns API error message when set password fails', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true })
    apiMocks.put.mockResolvedValueOnce({ success: false, message: '密码太弱' })

    const store = useAuthStore()
    const result = await store.changePassword('old-pwd', 'weak')

    expect(result.success).toBe(false)
    expect(result.message).toBe('密码太弱')
  })

  it('falls back to t("modifyFailed") on network error', async () => {
    apiMocks.post.mockResolvedValueOnce({ success: true })
    apiMocks.put.mockRejectedValueOnce(new Error('disconnect'))

    const store = useAuthStore()
    const result = await store.changePassword('old', 'new')

    expect(result.success).toBe(false)
    expect(result.message).toBe('disconnect')
  })
})
