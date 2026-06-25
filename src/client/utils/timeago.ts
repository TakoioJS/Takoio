/**
 * Timeago - 相对时间格式化
 */

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const i18n: Record<string, string[]> = {
  'zh-CN': ['秒', '分钟', '小时', '天', '周', '个月', '年', '刚刚', '前', '后'],
  'zh-TW': ['秒', '分鐘', '小時', '天', '週', '個月', '年', '剛剛', '前', '後'],
  en: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'just now', 'ago', 'in']
}

const detectLang = (): string => {
  if (typeof window === 'undefined') return 'zh-CN'
  const lang = window.navigator.language
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK')) return 'zh-TW'
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en'
}

let lang: string = 'zh-CN'

const format = (diff: number, future: boolean): string => {
  lang = detectLang()
  const [s, m, h, d, w, mo, y, now, ago, inStr] = i18n[lang] || i18n['zh-CN']

  if (diff < MINUTE) return future ? now : `1 ${m}${ago}`
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} ${m}${ago}`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} ${h}${ago}`
  if (diff < WEEK) return `${Math.floor(diff / DAY)} ${d}${ago}`
  if (diff < MONTH) return `${Math.floor(diff / WEEK)} ${w}${ago}`
  if (diff < YEAR) return `${Math.floor(diff / MONTH)} ${mo}${ago}`
  return `${Math.floor(diff / YEAR)} ${y}${ago}`
}

export const timeago = (date: number | Date, now: number = Date.now()): string => {
  const target = typeof date === 'number' ? date : date.getTime()
  const diff = Math.abs(now - target)
  const future = now < target
  return format(diff, future)
}

export default timeago
