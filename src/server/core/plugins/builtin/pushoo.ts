/**
 * Built-in Plugin: Pushoo Notifications
 *
 * Sends push notifications via Pushoo SDK to configured channels
 * (ServerChan, Telegram, Qmsg, etc.) when a comment is posted.
 * Uses postSubmit hook (fire-and-forget).
 */

import type { TakoioPlugin, HookContext } from '../types'

function parseChannels (config: Record<string, any>): Array<{ platform: string; token: string }> {
  const raw = config?.notification?.pushoo?.channels || config?.PUSHOO_CHANNELS
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    const channels: Array<{ platform: string; token: string }> = []
    for (const [platform, token] of Object.entries(parsed)) {
      if (typeof token === 'string' && token) channels.push({ platform, token })
    }
    return channels
  } catch { return [] }
}

export const pushooNotifyPlugin: TakoioPlugin = {
  name: 'notify-pushoo',
  version: '1.0.0',

  async postSubmit (comment, ctx: HookContext): Promise<void> {
    const cfg = ctx.config as any
    const channels = parseChannels(cfg)
    if (!channels.length) return

    const siteName = cfg?.site?.name || 'Takoio'
    const nick = comment.nick || ''
    const text = (comment.comment || '').slice(0, 200)

    for (const { platform, token } of channels) {
      try {
        const pushoo = (await import('pushoo')).default
        await pushoo(platform, {
          token,
          title: `${nick} 评论了「${siteName}」`,
          content: `${nick} 发表了评论：\n\n> ${text}${comment.comment && comment.comment.length > 200 ? '...' : ''}`,
        })
      } catch { /* non-critical — individual channel failures shouldn't break others */ }
    }
  },
}
