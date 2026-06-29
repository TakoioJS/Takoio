/**
 * Pushoo 通知模块 — 完整 20 渠道支持
 * 评论提交后通过 Pushoo SDK 向管理员推送通知
 */


interface PushConfig {
  PUSHOO_SC_KEY?: string
  PUSHOO_QMSG_KEY?: string
  PUSHOO_DINGTALK_TOKEN?: string
  PUSHOO_WECOMBOT_TOKEN?: string
  PUSHOO_WECOM_TOKEN?: string
  PUSHOO_FEISHU_TOKEN?: string
  PUSHOO_TELEGRAM_TOKEN?: string
  PUSHOO_BARK_TOKEN?: string
  PUSHOO_PUSHPLUS_TOKEN?: string
  PUSHOO_PUSHPLUSHXTRIP_TOKEN?: string
  PUSHOO_PUSHDEER_TOKEN?: string
  PUSHOO_WXPUSHER_TOKEN?: string
  PUSHOO_ONEBOT_TOKEN?: string
  PUSHOO_ATRI_TOKEN?: string
  PUSHOO_IGOT_TOKEN?: string
  PUSHOO_DISCORD_TOKEN?: string
  PUSHOO_IFTTT_TOKEN?: string
  PUSHOO_JOIN_TOKEN?: string
  PUSHOO_WEBHOOK_TOKEN?: string
  [key: string]: any
}

// 完整 20 渠道映射
const CHANNEL_MAP: Record<string, string> = {
  PUSHOO_SC_KEY: 'serverchan',
  PUSHOO_QMSG_KEY: 'qmsg',
  PUSHOO_DINGTALK_TOKEN: 'dingtalk',
  PUSHOO_WECOMBOT_TOKEN: 'wecombot',
  PUSHOO_WECOM_TOKEN: 'wecom',
  PUSHOO_FEISHU_TOKEN: 'feishu',
  PUSHOO_TELEGRAM_TOKEN: 'telegram',
  PUSHOO_BARK_TOKEN: 'bark',
  PUSHOO_PUSHPLUS_TOKEN: 'pushplus',
  PUSHOO_PUSHPLUSHXTRIP_TOKEN: 'pushplushxtrip',
  PUSHOO_PUSHDEER_TOKEN: 'pushdeer',
  PUSHOO_WXPUSHER_TOKEN: 'wxpusher',
  PUSHOO_ONEBOT_TOKEN: 'onebot',
  PUSHOO_ATRI_TOKEN: 'atri',
  PUSHOO_IGOT_TOKEN: 'igot',
  PUSHOO_DISCORD_TOKEN: 'discord',
  PUSHOO_IFTTT_TOKEN: 'ifttt',
  PUSHOO_JOIN_TOKEN: 'join',
  PUSHOO_WEBHOOK_TOKEN: 'webhook'
}

export interface NotifyPayload {
  title: string
  content: string
  siteName?: string
}

export async function sendNotification (config: PushConfig, payload: NotifyPayload): Promise<void> {
  if (!config) return

  // 独立渠道逐一发送
  for (const [key, platform] of Object.entries(CHANNEL_MAP)) {
    const token = config[key]
    if (!token) continue
    try {
      await sendOne(platform, token, payload)
    } catch (e: any) {
      console.error({ platform, error: e.message }, 'Notification send failed')
    }
  }
}

async function sendOne (platform: string, token: string, payload: NotifyPayload): Promise<void> {
  const pushoo = (await import('pushoo')).default
  await pushoo(platform, { token, title: payload.title, content: payload.content })
  console.info({ platform }, 'Notification sent')
}
