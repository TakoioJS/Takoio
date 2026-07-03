/**
 * Takoio 工具函数库 — URL/UA 工具（从 index.ts 拆出，Phase 7 Task 7.1.4）
 *
 * getUrl 依赖 normalizePath（从 ./path import）。
 */

import { normalizePath, type NormalizePathOpts } from './path'

/** 获取 URL（兼容魔法路径，支持规范化） */
export const getUrl = (path?: string, opts?: NormalizePathOpts): string => {
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
    url = typeof window !== 'undefined' ? window.location.pathname : '/'
  }
  return opts ? normalizePath(url, opts) : url
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
