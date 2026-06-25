/**
 * Takoio 客户端入口
 *
 * 纯 HTTP 通信，需要部署自托管服务端。
 */

import { version } from './version'
import { render } from './view'
import {
  setLanguage,
  isUrl,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount
} from './utils'
import type { TakoioConfig } from './types'

/** 初始化 Takoio */
export async function init (options: TakoioConfig = {} as TakoioConfig): Promise<void> {
  if (!options.envId || !isUrl(options.envId)) {
    console.error('Takoio: envId must be a URL (e.g. https://your-server.com)')
    return
  }
  setLanguage(options)
  render(options)
  await updateVisitorsCount({
    ...options,
    _isLocalhost: () => ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(
      typeof window !== 'undefined' ? window.location.hostname : ''
    )
  })
}

/** 获取评论计数 */
export async function getCommentsCount (
  options: { envId: string; urls: string[]; funcName?: string }
): Promise<Array<{ url: string; count: number }>> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getCommentsCount requires HTTP URL as envId')
    return []
  }
  return await getCommentsCountApi(options)
}

/** 获取最近评论 */
export async function getRecentComments (
  options: { envId: string; funcName?: string; count?: number; includeReply?: boolean }
): Promise<any[]> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getRecentComments requires HTTP URL as envId')
    return []
  }
  return await getRecentCommentsApi(options)
}

/** 获取访客计数 */
export async function getVisitorsCount (
  options: { envId: string; funcName?: string; url?: string; href?: string; title?: string }
): Promise<{ time: number } | null> {
  if (!isUrl(options.envId)) {
    console.error('Takoio: getVisitorsCount requires HTTP URL as envId')
    return null
  }
  const opts = { ...options, url: options.url || '/' }
  return await getVisitorsCountApi(opts)
}

export default init
export { version }
