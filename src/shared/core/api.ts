/**
 * @takoio/core — REST API Client
 *
 * Framework-agnostic HTTP client for the Takoio comment system.
 * Uses standard fetch with typed helpers for every endpoint.
 */

import { timeago } from './timeago'

// ========== Utility ==========

export const isUrl = (str: string): boolean => /^https?:\/\//.test(str)

// Phase 7 Task 7.2.6 决策（方案 C）：API_TIMEOUT_MS 保留在此处，不迁入 src/server/core/constants.ts
// 理由：跨包迁移需引入 packages/core → src/server/core 的包间依赖，与 monorepo 依赖方向相反
// （packages 应被 server 消费，而非反向引用 server 的 constants）
// 后续若需共享，应在 packages/common 下新增常量层，由两边共同 import
const API_TIMEOUT_MS = 30_000

const baseUrl = (envId: string): string => {
  if (!isUrl(envId)) throw new Error('Takoio: envId is required')
  return envId.replace(/\/$/, '')
}

// ========== Error Classification ==========

export type ApiErrorCategory = 'network' | 'timeout' | 'rate_limited' | 'server' | 'unknown'

export function classifyApiError (error: unknown): ApiErrorCategory {
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout'
  if (error instanceof Error) {
    if (error.name === 'TakoioTimeoutError' || error.message.includes('请求超时')) return 'timeout'
    if (error instanceof TypeError) return 'network'
    const httpMatch = error.message.match(/HTTP\s+(\d{3})/)
    if (httpMatch) {
      const status = Number(httpMatch[1])
      if (status === 429) return 'rate_limited'
      if (status >= 500) return 'server'
    }
  }
  return 'unknown'
}

// ========== Core Request ==========

export const request = async <T = any>(url: string, init?: RequestInit & { externalSignal?: AbortSignal }): Promise<T> => {
  const controller = new AbortController()
  const externalSignal = init?.externalSignal
  delete init?.externalSignal

  // 同时支持外部信号（调用方取消）和内部超时信号
  const onExternalAbort = () => controller.abort()
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        const e = new Error('请求已取消')
        e.name = 'TakoioCancelledError'
        throw e
      }
      const e = new Error('请求超时，请检查网络后重试')
      e.name = 'TakoioTimeoutError'
      throw e
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Takoio: HTTP ${res.status}`)
  }
  return res.json()
}

// ========== Configurable API Client (shared by admin / custom integrations) ==========

export interface ApiError extends Error {
  status?: number
  data?: any
}

export interface ApiClientOptions {
  /** 基础 URL（字符串或返回字符串的函数） */
  baseUrl?: string | (() => string)
  /** 获取当前认证 token */
  getToken?: () => string | null | undefined
  /** 不需要自动附加 Authorization 的路径片段 */
  skipAuthPaths?: string[]
  /** 401 回调 */
  onUnauthorized?: () => void
  /** 超时毫秒数，默认 30_000 */
  timeout?: number
  /** 自定义 HTTP 错误文案（接收 status） */
  formatHttpError?: (status: number) => string
  /** 自定义网络错误文案 */
  formatNetworkError?: () => string
}

export interface ApiClient {
  request: <T = any>(url: string, init?: RequestInit & { externalSignal?: AbortSignal }) => Promise<T>
  get: <T = any>(url: string, params?: Record<string, any>) => Promise<T>
  post: <T = any>(url: string, data?: any) => Promise<T>
  put: <T = any>(url: string, data?: any) => Promise<T>
  patch: <T = any>(url: string, data?: any) => Promise<T>
  delete: <T = any>(url: string) => Promise<T>
}

/** 创建可配置 API 客户端 */
export function createApiClient (options: ApiClientOptions = {}): ApiClient {
  const {
    baseUrl = '',
    getToken,
    skipAuthPaths = [],
    onUnauthorized,
    timeout = API_TIMEOUT_MS,
    formatHttpError,
    formatNetworkError,
  } = options

  function resolveBaseUrl (): string {
    return typeof baseUrl === 'function' ? baseUrl() : baseUrl
  }

  function shouldSkipAuth (url: string): boolean {
    return skipAuthPaths.some(path => url.includes(path))
  }

  async function request<T = any> (url: string, init?: RequestInit & { externalSignal?: AbortSignal }): Promise<T> {
    const controller = new AbortController()
    const externalSignal = init?.externalSignal
    delete init?.externalSignal

    const onExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const token = getToken?.()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
    }
    if (token && !shouldSkipAuth(url)) {
      headers.Authorization = `Bearer ${token}`
    }

    let res: Response
    try {
      res = await fetch(resolveBaseUrl() + url, { ...init, signal: controller.signal, headers })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (externalSignal?.aborted) {
          const e = new Error('请求已取消')
          e.name = 'TakoioCancelledError'
          throw e
        }
        const e = new Error('请求超时，请检查网络后重试')
        e.name = 'TakoioTimeoutError'
        throw e
      }
      const message = err instanceof Error ? err.message : (formatNetworkError?.() || 'Network error')
      const error = new Error(message) as ApiError
      throw error
    } finally {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(data.message || formatHttpError?.(res.status) || `Takoio: HTTP ${res.status}`) as ApiError
      error.status = res.status
      error.data = data
      if (res.status === 401) {
        onUnauthorized?.()
      }
      throw error
    }
    return data as T
  }

  function get<T = any> (url: string, params?: Record<string, any>): Promise<T> {
    const qs = params
      ? '?' + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
      ).toString()
      : ''
    return request<T>(url + qs)
  }

  function post<T = any> (url: string, data?: any): Promise<T> {
    return request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined })
  }

  function put<T = any> (url: string, data?: any): Promise<T> {
    return request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined })
  }

  function patch<T = any> (url: string, data?: any): Promise<T> {
    return request<T>(url, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined })
  }

  function del<T = any> (url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' })
  }

  return { request, get, post, put, patch, delete: del }
}

// ========== Comment API ==========

export const submitComment = (envId: string, data: {
  url: string;
  nick: string;
  comment: string;
  mail?: string;
  link?: string
  pid?: string;
  rid?: string;
  ua?: string;
  image?: string;
  sticker?: string
  title?: string;
  captchaToken?: string;
  href?: string;
  token?: string;
  /** 私密评论：开启后只有博主和评论作者本人可见 */
  isPrivate?: boolean
}): Promise<any> =>
  request(`${baseUrl(envId)}/api/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })

export const getComments = (envId: string, params: {
  url: string;
  page?: number;
  pageSize?: number;
  sort?: string
  signal?: AbortSignal
  /** 当前用户的 viewer token（social auth）；服务端用于识别作者本人，让其能看到自己的私密评论 */
  viewerToken?: string
}): Promise<any> => {
  const qs = new URLSearchParams()
  if (params.url) qs.set('url', params.url)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.sort) qs.set('sort', params.sort)
  if (params.viewerToken) qs.set('viewerToken', params.viewerToken)
  return request(`${baseUrl(envId)}/api/comments?${qs}`, { externalSignal: params.signal })
}

export const getCommentsCountApi = async (options: {
  envId: string; urls: string[]
}): Promise<Array<{ url: string; count: number }>> => {
  if (!Array.isArray(options.urls)) throw new Error('Takoio: urls 参数有误')
  if (options.urls.length === 0) return []
  const qs = `urls=${options.urls.join(',')}`
  const result = await request<any>(`${baseUrl(options.envId)}/api/comments/count?${qs}`)
  return result.data || []
}

export const getRecentCommentsApi = async (options: {
  envId: string; count?: number; includeReply?: boolean
}): Promise<any[]> => {
  const qs = options.count ? `?count=${options.count}` : ''
  const result = await request<any>(`${baseUrl(options.envId)}/api/comments/recent${qs}`)
  const data = result.data || []
  for (const item of data) item.relativeTime = timeago(item.created)
  return data
}

// ========== Visitor API ==========

export const getVisitorsCountApi = async (options: {
  envId: string; url: string; href?: string; title?: string
}): Promise<{ time: number; url: string; title?: string }> => {
  const qs = new URLSearchParams({ url: options.url })
  if (options.href) qs.set('href', options.href)
  if (options.title) qs.set('title', options.title)
  return request(`${baseUrl(options.envId)}/api/counter?${qs}`)
}

export const updateVisitorsCount = async (options: any): Promise<{ time: number } | null> => {
  if (typeof document === 'undefined') return null
  const counterEl = document.getElementById('takoio_visitors') || document.getElementById('twikoo_visitors')
  if (!counterEl) return null
  try {
    const counter = await getVisitorsCountApi({
      envId: options.envId,
      url: options._getUrl?.(options.path) || window.location.pathname,
      href: options._getHref?.(options.href) || window.location.href,
      title: options.title ?? document.title,
    })
    if (counter.time || counter.time === 0) counterEl.innerHTML = String(counter.time)
    return counter
  } catch (e) {
    console.warn('Takoio: Failed to update visitors count', e)
    return null
  }
}

// ========== Reaction API ==========

export const getReactions = (envId: string, url: string): Promise<{ reactions: Record<string, number>; myReactions: string[] }> =>
  request(`${baseUrl(envId)}/api/reactions?url=${encodeURIComponent(url)}`)

export const toggleReaction = (envId: string, url: string, emoji: string): Promise<{ reactions: Record<string, number>; myReactions: string[] }> =>
  request(`${baseUrl(envId)}/api/reactions?url=${encodeURIComponent(url)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
  })

export const getCommentReactions = (envId: string, commentId: string): Promise<{ reactions: Record<string, number>; myReaction: string | null }> =>
  request(`${baseUrl(envId)}/api/comments/${commentId}/reactions`)

export const toggleCommentReaction = (envId: string, commentId: string, emoji: string): Promise<{ reactions: Record<string, number>; myReaction: string | null }> =>
  request(`${baseUrl(envId)}/api/comments/${commentId}/reactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
  })

// ========== Admin API ==========

export const adminRequest = async (envId: string, token: string, path: string, method = 'GET', body?: any): Promise<any> => {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` }
  const init: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return request(`${baseUrl(envId)}${path}`, init)
}

// ========== Image Upload ==========

export const uploadImage = async (envId: string, image: string): Promise<{ url: string }> =>
  request(`${baseUrl(envId)}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })

// ========== AI Summary ==========

export const getArticleSummary = (envId: string, data: {
  content: string; url: string; title?: string
}): Promise<{ success: boolean; message: string; summary: string; keywords: string[]; cached: boolean }> =>
  request(`${baseUrl(envId)}/api/ai/article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

// ========== Auth API ==========

export const getAuthUrl = (envId: string, provider: string): string =>
  `${baseUrl(envId)}/api/auth/${provider}`

export const sendEmailCode = (envId: string, email: string, name?: string): Promise<{ uuid: string; message: string }> =>
  request(`${baseUrl(envId)}/api/auth/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  })

export const verifyEmailCode = (envId: string, uuid: string, code: string): Promise<{ token: string; user: { name: string; email: string; provider: string } }> =>
  request(`${baseUrl(envId)}/api/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, code }),
  })

export const getAuthUser = (envId: string, token: string): Promise<{ user: any }> =>
  request(`${baseUrl(envId)}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
