/**
 * Pushoo 通知模块 — PUSHOO_CHANNELS JSON 格式
 * 格式: '{"serverchan":"sct_xxx","telegram":"bot_xxx"}'
 */

export interface NotifyPayload {
  title: string
  content: string
  siteName?: string
}

function parseChannels (config: Record<string, any>): Array<{ platform: string; token: string }> {
  if (!config.PUSHOO_CHANNELS || typeof config.PUSHOO_CHANNELS !== 'string') return []
  try {
    const parsed = JSON.parse(config.PUSHOO_CHANNELS)
    const channels: Array<{ platform: string; token: string }> = []
    for (const [platform, token] of Object.entries(parsed)) {
      if (typeof token === 'string' && token) channels.push({ platform, token })
    }
    return channels
  } catch { return [] }
}

export async function sendNotification (config: Record<string, any>, payload: NotifyPayload): Promise<void> {
  if (!config) return

  for (const { platform, token } of parseChannels(config)) {
    try {
      const pushoo = (await import('pushoo')).default
      await pushoo(platform, { token, title: payload.title, content: payload.content })
      console.info({ platform }, 'Notification sent')
    } catch (e: any) {
      console.error({ platform, error: e.message }, 'Notification send failed')
    }
  }
}
