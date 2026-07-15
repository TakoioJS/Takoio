/**
 * Takoio 视图入口（Vue 3 重写）
 */

import { createApp, type App as VueApp } from 'vue'
import 'virtual:uno.css'
import App from './App.vue'
import { version, setLanguage } from '../utils'
import { sanitizeCustomCSS } from '../utils/sanitize-css'
import type { TakoioConfig } from '../types'

const containers: Map<string, HTMLElement> = new Map()
let app: VueApp | null = null

/**
 * 等待 DOM 元素就绪
 * 先同步查找，找不到则通过 MutationObserver 短暂等待，带超时兜底
 */
const waitForElement = (
  selector?: string | HTMLElement,
  timeout = 5000
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    // 1. 已经是 HTMLElement 直接返回
    if (selector instanceof HTMLElement) return resolve(selector)

    // 2. 立即能找到
    const el = typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : document.getElementById('takoio')
    if (el) return resolve(el)

    // 3. 用 MutationObserver 等它出现
    const observer = new MutationObserver(() => {
      const found = typeof selector === 'string'
        ? document.querySelector<HTMLElement>(selector)
        : document.getElementById('takoio')
      if (found) { observer.disconnect(); clearTimeout(timer); resolve(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    // 4. 超时兜底
    const timer = setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

/** 渲染 Takoio 组件 */
export const render = async (options: TakoioConfig): Promise<void> => {
  // Vue 缺失守卫：UMD 模式下 window.Vue 未加载时给出明确报错
  if (typeof createApp !== 'function') {
    console.error(
      'Takoio: Vue 3 is required but not found. ' +
      'Load Vue before Takoio:\n' +
      '<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>'
    )
    return
  }

  setLanguage(options)

  // 异步等待挂载目标就绪
  const el = await waitForElement(options.el, 5000)
  if (!el) {
    console.error(`Takoio: element "${options.el || '#takoio'}" not found after 5s`)
    return
  }

  // 处理自定义 CSS — 必须消毒防止 XSS（与 App.vue 使用同一规则）
  if (options.customCSS) {
    const style = document.createElement('style')
    style.id = 'takoio-custom-css'
    style.textContent = sanitizeCustomCSS(options.customCSS)
    style.setAttribute('data-takoio-custom-css', '')
    document.head.appendChild(style)
  }

  // 创建 Vue 应用
  app = createApp(App, {
    options
  })

  app.mount(el)
  containers.set(version, el)

  // 设置品牌色 CSS 变量
  if (options.brandColor) {
    const root = el.querySelector('.tk-root') as HTMLElement || el
    root.style.setProperty('--tk-brand', options.brandColor)
    root.style.setProperty('--tk-brand-hover', darken(options.brandColor, 0.1))
    root.style.setProperty('--tk-brand-light', hexToRgba(options.brandColor, 0.1))
    root.style.setProperty('--tk-brand-ring', hexToRgba(options.brandColor, 0.4))
  }
}

/** 将 hex 颜色变暗指定比例 */
const darken = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgb(${Math.round(rgb.r * (1 - amount))}, ${Math.round(rgb.g * (1 - amount))}, ${Math.round(rgb.b * (1 - amount))})`
}

/** 将 hex 颜色转为 rgba */
const hexToRgba = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

export { version }
export type { TakoioConfig }
