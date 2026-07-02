/**
 * 国际化 — 从 @takoio/common 导入翻译数据
 */

import type { TakoioConfig } from '../types'
import { messages } from '@takoio/common'
import type { Lang } from '@takoio/common'

export type { Lang }

let currentLang: Lang = 'zh-CN'

/** 检测浏览器语言 */
const detectLanguage = (): Lang => {
  if (typeof window === 'undefined') return 'zh-CN'
  const browserLang = window.navigator.language
  if (browserLang.startsWith('zh-CN') || browserLang === 'zh') return 'zh-CN'
  if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) return 'zh-TW'
  if (browserLang.startsWith('en')) return 'en'
  return 'zh-CN'
}

/** 设置语言 */
export const setLanguage = (options: TakoioConfig): void => {
  const lang = options.lang || (typeof window !== 'undefined' && (window.navigator?.language)) || 'zh-CN'
  if (messages[lang]) {
    currentLang = lang
  } else if (lang.startsWith('zh')) {
    currentLang = lang.includes('TW') || lang.includes('HK') ? 'zh-TW' : 'zh-CN'
  } else {
    currentLang = detectLanguage()
  }
}

/** 翻译 */
export const t = (key: string): string => {
  return messages[currentLang]?.[key] || messages['zh-CN'][key] || key
}

export { detectLanguage }
