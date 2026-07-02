/**
 * useFormatTime — 通用时间格式化 composable
 *
 * 统一 Dashboard / List / Summary 中重复的 formatTime 函数。
 * 支持两种格式：
 * - relative: 相对时间（"刚刚"、"3 分钟前"），适用于 Dashboard
 * - absolute: 绝对时间（"2024-01-01 12:00"），适用于 List / Summary
 */

export type TimeFormat = 'relative' | 'absolute'

export function formatTime (ts: number, format: TimeFormat = 'absolute'): string {
  const d = new Date(ts)

  if (format === 'relative') {
    const now = new Date()
    const diff = now.getTime() - ts
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // absolute
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 格式化刷新时间（HH:mm:ss） */
export function formatRefreshTime (ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** 格式化数字（中文本地化） */
export function formatNumber (n: number): string {
  return n.toLocaleString('zh-CN')
}
