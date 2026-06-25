/**
 * Takoio 视图入口（Vue 3 重写）
 */

import { createApp, type App as VueApp } from 'vue'
import 'virtual:uno.css'
import App from './App.vue'
import { version, setLanguage } from '../utils'
import type { TakoioConfig } from '../types'

const containers: Map<string, HTMLElement> = new Map()
let app: VueApp | null = null

/** 渲染 Takoio 组件 */
export const render = (
  options: TakoioConfig
): void => {
  setLanguage(options)

  // 解析挂载目标
  const el = resolveElement(options.el)
  if (!el) {
    console.error('Takoio: target element not found')
    return
  }

  // 处理自定义 CSS
  if (options.customCSS) {
    const style = document.createElement('style')
    style.id = 'takoio-custom-css'
    style.textContent = options.customCSS
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

const resolveElement = (selector?: string | HTMLElement): HTMLElement | null => {
  if (!selector) {
    return document.getElementById('takoio')
  }
  if (typeof selector === 'string') {
    return document.querySelector(selector)
  }
  return selector
}

export { version }
export type { TakoioConfig }
