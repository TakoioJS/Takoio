/**
 * @takoio/core — REST API Client
 *
 * Framework-agnostic HTTP client for the Takoio comment system.
 * Uses standard fetch with typed helpers for every endpoint.
 */

import { timeago } from './timeago'

// ========== Utility ==========

export const isUrl = (str: string): boolean => /^https?:\/\//.test(str)

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
  token?: string
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
}): Promise<any> => {
  const qs = new URLSearchParams()
  if (params.url) qs.set('url', params.url)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.sort) qs.set('sort', params.sort)
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
