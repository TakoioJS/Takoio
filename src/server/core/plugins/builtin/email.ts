/**
 * Built-in Plugin: Email Notifications
 *
 * Sends email notifications when a comment is posted:
 * - Reply notification to the parent comment author
 * - Admin notification to configured SMTP_TO address
 * Uses postSubmit hook (fire-and-forget).
 */

import type { TakoioPlugin, HookContext } from '../types'
import { commentStore } from '../../store/index'
import { sendEmail } from '../../email'
import { escapeHtml } from '../../handlers/_comment-shared'

function renderTpl (tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{ (\w+) \}\}/g, (_, k: string) => {
    const v = vars[k] || `{{ ${k} }}`
    return escapeHtml(v)
  })
}

export const emailNotifyPlugin: TakoioPlugin = {
  name: 'notify-email',
  version: '1.0.0',

  async postSubmit (comment, ctx: HookContext): Promise<void> {
    const cfg = ctx.config as Record<string, any>

    if (!cfg?.ENABLE_MAIL_NOTIFICATION || !cfg?.SMTP_HOST) return

    const siteName = cfg?.SITE_NAME || 'Takoio'
    const mail = comment.mail || ''
    const nick = comment.nick || ''
    const text = (comment.comment || '').slice(0, 500)
    const url = comment.url || '/'
    const pid = (comment as any).pid || null
    const rid = (comment as any).rid || null
    const ip = (comment as any).ip || 'unknown'
    const ua = (comment as any).ua || 'unknown'

    // Reply notification
    const parentId = rid || pid
    if (parentId) {
      try {
        const parentComment = await commentStore.getComment(parentId)
        if (parentComment?.mail && parentComment.mail !== mail) {
          const vars = {
            siteName,
            nick: parentComment.nick || '',
            title: url,
            comment: text,
            url: `https://your-site.com${url}`,
          }
          await sendEmail(
            cfg,
            renderTpl(cfg.MAIL_SUBJECT || '有人在 {title} 中回复了你', vars),
            renderTpl(cfg.MAIL_TEMPLATE || '', vars)
          )
        }
      } catch { /* non-critical */ }
    }

    // Admin notification
    if (cfg?.SMTP_TO) {
      try {
        const adminVars = {
          siteName,
          nick,
          title: url,
          comment: text,
          url: `https://your-site.com${url}`,
          ip,
          ua,
        }
        await sendEmail(
          cfg,
          renderTpl(cfg.MAIL_SUBJECT_ADMIN || '新的评论：{nick} 在 {title}', adminVars),
          renderTpl(cfg.MAIL_TEMPLATE_ADMIN || '', adminVars)
        )
      } catch { /* non-critical */ }
    }
  },
}
