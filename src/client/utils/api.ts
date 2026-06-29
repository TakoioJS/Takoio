/**
 * Takoio API — REST client (Hono RPC style)
 * Uses standard fetch with typed helpers for every endpoint.
 */

import type { Comment } from '../types'
import { isUrl } from './index' // safe: isUrl used at call-time, not module eval
import { timeago } from './timeago'



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

const API_TIMEOUT_MS = 30_000

const baseUrl = (envId: string): string => {
  if (!isUrl(envId)) throw new Error('Takoio: envId is required')
  return envId.replace(/\/$/, '')
}

export const request = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const e = new Error('请求超时，请检查网络后重试')
      e.name = 'TakoioTimeoutError'
      throw e
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Takoio: HTTP ${res.status}`)
  }
  return res.json()
}

// ========== Typed API Functions ==========

/** Submit a comment */
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
  href?: string
}): Promise<any> =>
  request(`${baseUrl(envId)}/api/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })

/** Get comments for a URL */
export const getComments = (envId: string, params: {
  url: string; page?: number; pageSize?: number; sort?: string
}): Promise<any> => {
  const qs = new URLSearchParams()
  if (params.url) qs.set('url', params.url)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.sort) qs.set('sort', params.sort)
  return request(`${baseUrl(envId)}/api/comments?${qs}`)
}

/** Like a comment */
export const likeComment = (envId: string, id: string): Promise<any> =>
  request(`${baseUrl(envId)}/api/comments/${id}/like`, { method: 'POST' })

/** Dislike a comment */
export const dislikeComment = (envId: string, id: string): Promise<any> =>
  request(`${baseUrl(envId)}/api/comments/${id}/dislike`, { method: 'POST' })

/** Get comments count for multiple URLs */
export const getCommentsCountApi = async (options: {
  envId: string; urls: string[]; funcName?: string
}): Promise<Array<{ url: string; count: number }>> => {
  if (!Array.isArray(options.urls)) throw new Error('Takoio: urls 参数有误')
  if (options.urls.length === 0) return []
  const qs = `urls=${options.urls.join(',')}`
  const result = await request<any>(`${baseUrl(options.envId)}/api/comments/count?${qs}`)
  return result.data || []
}

/** Get recent comments */
export const getRecentCommentsApi = async (options: {
  envId: string; funcName?: string; count?: number; includeReply?: boolean
}): Promise<Comment[]> => {
  const qs = options.count ? `?count=${options.count}` : ''
  const result = await request<any>(`${baseUrl(options.envId)}/api/comments/recent${qs}`)
  const data = result.data || []
  for (const comment of data) comment.relativeTime = timeago(comment.created)
  return data
}

/** Get visitor count */
export const getVisitorsCountApi = async (options: {
  envId: string; funcName?: string; url: string; href?: string; title?: string
}): Promise<{ time: number; url: string; title?: string }> => {
  const qs = new URLSearchParams({ url: options.url })
  if (options.href) qs.set('href', options.href)
  if (options.title) qs.set('title', options.title)
  return request(`${baseUrl(options.envId)}/api/counter?${qs}`)
}

/** Update visitor count */
export const updateVisitorsCount = async (options: any): Promise<{ time: number } | null> => {
  if (typeof document === 'undefined') return null
  const counterEl = document.getElementById('takoio_visitors') || document.getElementById('twikoo_visitors')
  if (!counterEl) return null
  try {
    const counter = await getVisitorsCountApi({
      envId: options.envId,
      funcName: options.funcName,
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

/** Get reactions for a URL */
export const getReactions = (envId: string, url: string): Promise<{ reactions: Record<string, number>; myReactions: string[] }> =>
  request(`${baseUrl(envId)}/api/reactions?url=${encodeURIComponent(url)}`)

/** Toggle a reaction on a URL */
export const toggleReaction = (envId: string, url: string, emoji: string): Promise<{ reactions: Record<string, number>; myReactions: string[] }> =>
  request(`${baseUrl(envId)}/api/reactions?url=${encodeURIComponent(url)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
  })


/** Generic admin API call (used by components for admin operations) */
export const adminRequest = async (envId: string, token: string, path: string, method: string = 'GET', body?: any): Promise<any> => {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` }
  const init: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return request(`${baseUrl(envId)}${path}`, init)
}

/** Upload image */
export const uploadImage = async (envId: string, image: string): Promise<{ url: string }> => {
  return request(`${baseUrl(envId)}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })
}

/** Submit comment */
export const submitCommentFn = submitComment

/** Get AI article summary (public, cached server-side) */
export const getArticleSummary = (envId: string, data: {
  content: string; url: string; title?: string
}): Promise<{ success: boolean; message: string; summary: string; keywords: string[]; cached: boolean }> =>
  request(`${baseUrl(envId)}/api/ai/article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
