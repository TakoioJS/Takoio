/**
 * Comment Submit Side Effects — cache invalidation, SSE, email/push notifications.
 *
 * 从 comment-submit.ts 抽出（Phase 3 Task 3.5）。
 * 主流程只保留校验/鉴权/限流/审核/持久化；副作用集中于此文件。
 */

import type { TakoioConfig } from '../config'
import { invalidateCommentListCache } from '../store/redis'
import { logger } from '../utils/logger'

// ========== Cache Invalidation + SSE Notification ==========

/**
 * 提交后副作用 1：缓存失效 + SSE 实时通知。
 * - 缓存失效重试 3 次（100ms / 200ms 退避），主流程 await
 * - SSE 通知通过动态 import events 模块（fire-and-forget）
 */
export async function invalidateAfterSubmit (url: string, saved: any): Promise<void> {
  // 1. Invalidate comment list cache for this url (retry up to 3 times)
  let cacheInvalidated = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await invalidateCommentListCache(url)
      cacheInvalidated = true
      break
    } catch (e) {
      logger.warn(`[comment-submit] Cache invalidation attempt ${attempt} failed:`, e)
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 100 * attempt))
      }
    }
  }
  if (!cacheInvalidated) {
    logger.error('[comment-submit] Cache invalidation failed after 3 attempts — data may be stale')
  }

  // 2. SSE real-time notification (fire-and-forget)
  import('../events').then(({ notifyComment }) => {
    notifyComment(url, 'comment:new', {
      comment: { id: saved.id, nick: saved.nick, comment: saved.comment, created: saved.created, url: saved.url },
    })
  }).catch(e => logger.error('[comment-submit] SSE notify failed:', e))
}

// ========== Email + Push Notifications ==========

async function sendEmailNotification (saved: any, cfg: TakoioConfig) {
  if (!cfg.ENABLE_MAIL_NOTIFICATION || !cfg.SMTP_HOST) return
  try {
    const { sendEmail } = await import('../email')
    await sendEmail(cfg, cfg.SMTP_TO || cfg.SMTP_USER, '新评论通知', `用户 ${saved.nick} 发表了评论`)
  } catch { /* ignore */ }
}

async function sendPushNotification (saved: any, cfg: TakoioConfig) {
  if (!cfg.PUSHOO_CHANNELS) return
  try {
    const { sendNotification } = await import('../notify')
    await sendNotification(cfg, { title: '新评论', content: `${saved.nick}: ${saved.comment}` })
  } catch { /* ignore */ }
}

/**
 * 提交后副作用 2：邮件 + 推送通知（fire-and-forget）。
 * 内部并发触发两类通知，互不阻塞；调用方无需 await。
 */
export function notifyAfterSubmit (saved: any, cfg: TakoioConfig): void {
  sendEmailNotification(saved, cfg).catch(() => {})
  sendPushNotification(saved, cfg).catch(() => {})
}
