/**
 * Social Auth Token Manager — client-side
 *
 * Handles:
 *   1. OAuth callback: URL contains ?token=xxx after redirect, fetch /api/auth/me to get user, store
 *   2. Token persistence: localStorage, auto-expire check
 *   3. Auth state subscription: onAuthChange() for components to react to login/logout
 *   4. Logout: clear local + notify subscribers
 */

const AUTH_STORAGE_KEY = 'takoio_auth'
const AUTH_CHANGE_EVENT = 'takoio:auth-change'

export interface AuthUser {
  provider: 'github' | 'google' | 'email'
  id: string
  name: string
  email?: string
  avatar?: string
}

export interface AuthState {
  token: string
  user: AuthUser
}

/** Check if JWT token is expired (parse exp from payload locally) */
export function isTokenExpired (token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    // base64url decode payload (atob requires standard base64, must re-pad)
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    if (typeof payload.exp !== 'number') return false
    // JWT exp is in seconds; Date.now() is in milliseconds
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

/** Get stored auth state, returns null if missing or expired */
export function getAuthState (): AuthState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as AuthState
    if (!state.token || !state.user) return null
    if (isTokenExpired(state.token)) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}

/** Store auth state */
export function setAuthState (state: AuthState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: state }))
}

/** Clear auth state and notify subscribers */
export function clearAuthState (): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: null }))
}

/** Check if current URL is an auth callback and extract token.
 *  Now REAL: fetches /api/auth/me?token=xxx to get actual user info.
 *  Returns the auth state on success, or null on failure/missing.
 */
export async function checkAuthCallback (): Promise<AuthState | null> {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (!token) return null

  try {
    // Fetch /me to get actual user info (not just hardcode 'oauth')
    const res = await fetch(
      `${url.origin}/api/auth/me?token=${encodeURIComponent(token)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.user) return null

    const state: AuthState = {
      token,
      user: {
        provider: data.user.provider,
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        avatar: data.user.avatar,
      },
    }

    setAuthState(state)
    // Clean URL
    window.history.replaceState({}, '', url.origin + url.pathname)
    return state
  } catch {
    return null
  }
}

/** Get current user from server (re-validate token).
 *  Returns null if no auth or server rejects token.
 */
export async function getCurrentUser (): Promise<AuthUser | null> {
  const state = getAuthState()
  if (!state) return null
  try {
    const envId = (typeof window !== 'undefined' && (window as any).__TAKOIO_ENV_ID__) || ''
    const base = envId.replace(/\/$/, '') || window.location.origin
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${state.token}` }
    })
    if (!res.ok) {
      clearAuthState()
      return null
    }
    const data = await res.json()
    if (!data.user) {
      clearAuthState()
      return null
    }
    // Update local cache with fresh user info
    setAuthState({ token: state.token, user: data.user })
    return data.user as AuthUser
  } catch {
    return null
  }
}

/** Logout: call server + clear local + notify subscribers */
export async function logout (): Promise<void> {
  const state = getAuthState()
  if (state) {
    try {
      const envId = (typeof window !== 'undefined' && (window as any).__TAKOIO_ENV_ID__) || ''
      const base = envId.replace(/\/$/, '') || window.location.origin
      await fetch(`${base}/api/auth/logout`, { method: 'POST' })
    } catch { /* best-effort */ }
  }
  clearAuthState()
}

/** Subscribe to auth state changes.
 *  Returns an unsubscribe function.
 *  Callback receives the new state (or null if logged out).
 */
export function onAuthChange (callback: (state: AuthState | null) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AuthState | null>).detail
    callback(detail ?? null)
  }
  window.addEventListener(AUTH_CHANGE_EVENT, handler)
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler)
}

/** Get login URL for a provider.
 *  Constructs from envId (which is the takoio server base URL).
 */
export function getLoginUrl (envId: string, provider: 'github' | 'google' | 'email'): string {
  if (provider === 'email') return '' // handled in UI
  const base = envId.replace(/\/$/, '')
  return `${base}/api/auth/${provider}`
}

// ========== Available Providers Discovery ==========

export interface AvailableProviders {
  github: boolean
  google: boolean
  email: boolean
}

interface ProvidersCache {
  value: AvailableProviders
  ts: number
  envId: string
}

let _providersCache: ProvidersCache | null = null
const PROVIDERS_TTL = 60_000 // 60s 内存缓存，避免每次渲染都请求

/**
 * 从 /api/auth/providers 拉取后端实际启用的 provider 列表。
 *
 * 数据源优先级（前端 loginProviders 计算属性会按此顺序合并）：
 *   1) 用户在 init 时显式传入 options.loginProviders
 *   2) 后端 publicConfigSubset 暴露的 LOGIN_PROVIDERS 字段（预留扩展点）
 *   3) 本接口返回的自动发现结果
 *
 * 失败时返回全 false（不影响 UI，只是下拉不显示）。
 */
export async function getAvailableProviders (envId: string): Promise<AvailableProviders> {
  if (typeof window === 'undefined') return { github: false, google: false, email: false }

  // 命中缓存（同 envId + 未过期）直接返回
  if (_providersCache && _providersCache.envId === envId && Date.now() - _providersCache.ts < PROVIDERS_TTL) {
    return _providersCache.value
  }

  const base = (envId || window.location.origin).replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/auth/providers`, { method: 'GET' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const result: AvailableProviders = {
      github: !!data.github,
      google: !!data.google,
      email: !!data.email,
    }
    _providersCache = { value: result, ts: Date.now(), envId }
    return result
  } catch {
    // 失败时不缓存，避免短时间内反复打挂掉的服务
    return { github: false, google: false, email: false }
  }
}

/** 清空 provider 缓存（用于配置变更后强制重拉） */
export function invalidateProvidersCache (): void {
  _providersCache = null
}
