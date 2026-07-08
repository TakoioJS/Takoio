import { createApiClient, type ApiError } from '@takoio/core'
import { t } from '@takoio/common'

export type { ApiError }

let _onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler (handler: () => void) {
  _onUnauthorized = handler
}

function getBaseUrl (): string {
  return (import.meta as any).env?.VITE_API_BASE || ''
}

function getToken (): string | null {
  const auth = useAuthStore()
  return auth.token || null
}

function handleUnauthorized () {
  const auth = useAuthStore()
  auth.logout()
  _onUnauthorized?.()
}

/**
 * Admin SPA API client — 复用 @takoio/core 的 createApiClient。
 * 保留原 api / setUnauthorizedHandler 导出，admin 其他模块无需改动。
 */
export const api = createApiClient({
  baseUrl: getBaseUrl,
  getToken,
  skipAuthPaths: ['/login', '/setup'],
  onUnauthorized: handleUnauthorized,
  formatHttpError: (status) => `${t('requestFailed')} (${status})`,
  formatNetworkError: () => t('networkError'),
})
