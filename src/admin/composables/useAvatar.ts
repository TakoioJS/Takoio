/**
 * useAvatar — 通用头像 URL 生成工具
 *
 * 统一 Dashboard / List 中重复的 getAvatar 函数。
 */

interface AvatarItem {
  mailMd5?: string
  nick?: string
}

/** 生成头像 URL */
export function getAvatar(item: AvatarItem, size = 40): string {
  const base = 'https://weavatar.com/avatar/'
  const hash = item.mailMd5 || encodeURIComponent(item.nick || '?')
  return `${base}${hash}?d=identicon&s=${size}`
}

/** 根据昵称生成头像背景色 */
export function avatarColor(nick: string): string {
  const colors = ['#5E8C6A', '#8A7C5E', '#8A5E5E', '#5E6E8A', '#8A5E7C', '#5E8A7C']
  let hash = 0
  for (let i = 0; i < nick.length; i++) {
    hash = nick.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
