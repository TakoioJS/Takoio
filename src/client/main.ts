/**
 * Takoio 客户端入口
 *
 * 纯 HTTP 通信，需要部署自托管服务端。
 */

import { render } from './view'
import { version } from './utils'
import {
  setLanguage,
  isUrl,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount
} from './utils'
import { getArticleSummary as getArticleSummaryApi } from './utils'
import type { TakoioConfig } from './types'
import { checkAuthCallback } from './utils/auth'

/** 初始化 Takoio */
export async function init (options: TakoioConfig = {} as TakoioConfig): Promise<void> {
  if (!options.envId || !isUrl(options.envId)) {
    console.error('Takoio: envId must be a URL (e.g. https://your-server.com)')
    return
  }

  // Check for OAuth callback token in URL
  checkAuthCallback()

  setLanguage(options)
  await render(options)
  await updateVisitorsCount({
    ...options,
    _isLocalhost: () => ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(
      typeof window !== 'undefined' ? window.location.hostname : ''
    )
  })
}

/** 获取评论计数 */
export async function getCommentsCount (
  options: { envId: string; urls: string[] }
): Promise<Array<{ url: string; count: number }>> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getCommentsCount requires HTTP URL as envId')
    return []
  }
  return await getCommentsCountApi(options)
}

/** 获取最近评论 */
export async function getRecentComments (
  options: { envId: string; count?: number; includeReply?: boolean }
): Promise<any[]> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getRecentComments requires HTTP URL as envId')
    return []
  }
  return await getRecentCommentsApi(options)
}

/** 获取访客计数 */
export async function getVisitorsCount (
  options: { envId: string; url?: string; href?: string; title?: string }
): Promise<{ time: number } | null> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getVisitorsCount requires HTTP URL as envId')
    return null
  }
  const opts = { ...options, url: options.url || '/' }
  return await getVisitorsCountApi(opts)
}

/** 获取文章 AI 摘要（供自定义组件调用，公开 API）
 *
 * 用法：宿主自行渲染摘要 UI 时，通过此 API 取数：
 *   const { summary, keywords, cached } = await getArticleSummary({
 *     envId: 'https://your-server.com',
 *     content: '文章正文',
 *     url: window.location.pathname,
 *     title: '文章标题',
 *   })
 */
export async function getArticleSummary (
  options: { envId: string; content: string; url: string; title?: string }
): Promise<{ success: boolean; summary: string; keywords: string[]; cached: boolean; message: string }> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getArticleSummary requires HTTP URL as envId')
    return { success: false, summary: '', keywords: [], cached: false, message: 'invalid envId' }
  }
  return await getArticleSummaryApi(options.envId, {
    content: options.content,
    url: options.url,
    title: options.title,
  })
}

export { version }
