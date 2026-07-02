/**
 * Social Auth Token Manager — client-side
 *
 * Handles:
 *   1. OAuth callback: URL contains ?token=xxx after redirect, store it
 *   2. Token persistence: localStorage, auto-attach to comment submissions
 *   3. Login UI trigger: expose to Vue components
 */

const AUTH_STORAGE_KEY = 'takoio_auth'

export interface AuthState {
  token: string
  user: { name: string; email?: string; avatar?: string; provider: string }
}

/** Check if current URL is an auth callback and extract token */
export function checkAuthCallback (): AuthState | null {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (!token) return null

  const name = url.searchParams.get('name') || ''
  const avatar = url.searchParams.get('avatar') || ''
  const provider = '' // will be determined by /api/auth/me

  const state: AuthState = {
    token,
    user: { name, avatar, provider: 'oauth' },
  }

  // Store and clean URL
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
  const cleanUrl = url.origin + url.pathname
  window.history.replaceState({}, '', cleanUrl)

  return state
}

/** Get stored auth state */
export function getAuthState (): AuthState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthState
  } catch {
    return null
  }
}

/** Store auth state */
export function setAuthState (state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
}

/** Clear auth state (logout) */
export function clearAuthState (): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

/** Get login URL for a provider */
export function getLoginUrl (envId: string, provider: 'github' | 'google' | 'email'): string {
  if (provider === 'email') return '' // handled in UI
  const base = envId.replace(/\/$/, '')
  return `${base}/api/auth/${provider}`
}
