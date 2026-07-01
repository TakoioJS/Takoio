/**
 * Takoio 工具函数库（TypeScript 重写版）
 */

import pkg from '../../../package.json'

/** 判断是否未设置 */
export const isNotSet = (option: any): boolean => {
  return option === undefined || option === null || option === ''
}

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

/** 时间戳 */
export const timestamp = (date: Date = new Date()): number => {
  return date.getTime()
}

/** 标准化链接 */
export const convertLink = (link: string): string => {
  if (!link) return ''
  if (link.substring(0, 4) !== 'http') return `http://${link}`
  return link
}

/** 判断是否为 URL */
export const isUrl = (str: string): boolean => {
  if (!str) return false
  return /^https?:\/\//.test(str)
}

/** 读取文本文件 */
export const readAsText = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      if (reader.error) reject(reader.error)
      else resolve(reader.result as string)
    }
  })
}

/** Blob 转 DataURL */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const base64 = (evt.target?.result as string) || ''
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
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

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
export const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false
  return LOCALHOST_HOSTNAMES.has(window.location.hostname)
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

/** 标准化邮箱 */
export const normalizeMail = (mail: string): string => {
  if (!mail) return ''
  return mail.trim().toLowerCase()
}

/** 判断是否为 QQ 号 */
export const isQQ = (str: string): boolean => {
  return /^([1-9]\d{4,11})$/.test(str)
}

/** 获取 QQ 头像 */
export const getQQAvatar = (qq: string): string => {
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`
}

export {
  request,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount,
  adminRequest,
  uploadImage,
  getComments,
  submitComment,
  getReactions,
  toggleReaction,
} from './api'
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
export { timeago } from './timeago'
export { renderTex } from './tex'

export const version = String(pkg.version)
