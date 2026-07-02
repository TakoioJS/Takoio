/**
 * Takoio 工具函数库（TypeScript 重写版）
 */

import pkg from '../../../package.json'

/** 日志工具 */
export const logger = {
  log: (message: string, ...args: any[]) => {
    console.log(`Takoio: ${message}`, ...args)
  },
  info: (message: string, ...args: any[]) => {
    console.info(`Takoio: ${message}`, ...args)
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`Takoio: ${message}`, ...args)
  },
  error: (message: string, ...args: any[]) => {
    console.error(`Takoio: ${message}`, ...args)
  }
}

/** 渲染链接（新窗口打开） */
export const renderLinks = (el: Element | Element[] | null): void => {
  if (!el) return
  let aEls: HTMLAnchorElement[] = [] as any
  if (Array.isArray(el)) {
    el.forEach((item) => {
      aEls = [...aEls, ...item.getElementsByTagName('a')]
    })
  } else {
    aEls = Array.from(el.getElementsByTagName('a'))
  }
  for (const aEl of aEls) {
    aEl.setAttribute('target', '_blank')
    aEl.setAttribute('rel', 'noopener noreferrer nofollow ugc')
  }
}

/** 获取 URL（兼容魔法路径） */
export const getUrl = (path?: string): string => {
  let url: string
  if (typeof window !== 'undefined' && (window as any).TAKOIO_MAGIC_PATH) {
    url = (window as any).TAKOIO_MAGIC_PATH
  } else if (path && typeof path === 'string') {
    switch (path) {
      case 'location.pathname':
      case 'window.location.pathname':
        url = window.location.pathname
        break
      case 'location.href':
      case 'window.location.href':
        url = window.location.href
        break
      default:
        url = path
    }
  } else {
    url = window.location.pathname
  }
  return url
}

/** 获取完整链接 */
export const getHref = (href?: string): string => {
  if (typeof window === 'undefined') return href || ''
  return (window as any).TAKOIO_MAGIC_HREF ?? href ?? window.location.href
}

/** 获取 User-Agent（兼容 Windows 11 / macOS 11+） */
export const getUserAgent = async (): Promise<string> => {
  if (typeof window === 'undefined') return ''
  let ua = window.navigator.userAgent
  try {
    const nav = navigator as any
    if (nav.userAgentData) {
      const { platform } = nav.userAgentData
      if (platform === 'Windows' || platform === 'macOS') {
        const { platformVersion } = await nav.userAgentData.getHighEntropyValues(['platformVersion'])
        const majorPlatformVersion = parseInt(platformVersion.split('.')[0])
        if (platform === 'Windows' && majorPlatformVersion >= 13) {
          ua = ua.replace(/Windows NT 10\.0/i, 'Windows NT 11.0')
        } else if (platform === 'macOS' && majorPlatformVersion >= 11) {
          const correctVersion = platformVersion.replace(/\./g, '_')
          ua = ua.replace(/Mac OS X 10_[0-9]+_[0-9]+/i, `Mac OS X ${correctVersion}`)
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return ua
}

export {
  request,
  submitComment,
  getComments,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount,
  getReactions,
  toggleReaction,
  getCommentReactions,
  toggleCommentReaction,
  adminRequest,
  uploadImage,
  getArticleSummary,
  classifyApiError,
  isUrl,
} from '@takoio/core'

export type { ApiErrorCategory } from '@takoio/core'
/** 安全 URL 校验：只允许 http/https，防止 javascript: data: 等伪协议 */
export const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return '#'
    return parsed.toString()
  } catch {
    // 没有协议的，自动加 https:
    if (/^[a-zA-Z][a-zA-Z0-9+-.]*:/.test(url)) return '#'
    return `https://${url}`
  }
}

// ponytail: tiny DOM toast, replaces ElMessage
export const toast = (msg: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000): void => {
  const el = document.createElement('div')
  el.textContent = msg; el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:8px;font-size:14px;color:#fff;background:${type === 'error' ? '#ef4444' : type === 'info' ? '#6b7280' : '#10b981'};box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity .3s;opacity:0`
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300) }, duration)
}

export { setLanguage, t } from './i18n'
export { timeago } from '@takoio/core'
export { renderTex } from './tex'

export const version = String(pkg.version)
