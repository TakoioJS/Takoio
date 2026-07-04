/**
 * Admin Notify handlers — send notification, email test (with local renderTemplate).
 *
 * 从 admin.ts 抽出（Phase 3 Task 3.3）。
 */

import { safeValidate, SendNotificationSchema, EmailTestSchema } from '../schemas'
import type { SendNotificationData, EmailTestData } from '../schemas'
import { getConfig } from '../config'
import { sendNotification } from '../notify'
import { sendEmail } from '../email'
import { AppError } from '../errors'
import { escapeHtml } from '@takoio/common'

// ========== Send Notification ==========

export const handleSendNotification = async (data: SendNotificationData) => {
  const validation = safeValidate(SendNotificationSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const cfg = await getConfig()
  const { title, content } = validation.data
  await sendNotification(cfg, { title: title || 'Takoio 通知', content: content || '' })
  return { success: true }
}

// ========== Email Test ==========

const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{ (\w+) \}\}/g, (_, k: string) => {
    const value = vars[k]
    return value !== undefined ? escapeHtml(value) : `{{ ${k} }}`
  })

export const handleEmailTest = async (data: EmailTestData) => {
  const validation = safeValidate(EmailTestSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const cfg = await getConfig()
  // 不修改全局配置缓存：构造本地覆盖对象传递给 sendEmail
  const emailCfg = validation.data.email
    ? { ...cfg, SMTP_TO: validation.data.email }
    : cfg

  const isAdmin = validation.data.template === 'admin'
  const subject = isAdmin
    ? (cfg.MAIL_SUBJECT_ADMIN || '新的评论：{nick} 在 {title}')
    : (cfg.MAIL_SUBJECT || '有人在 {title} 中回复了你')
  const rawTpl = isAdmin
    ? (cfg.MAIL_TEMPLATE_ADMIN || cfg.MAIL_TEMPLATE)
    : (cfg.MAIL_TEMPLATE || cfg.MAIL_TEMPLATE_ADMIN)

  const vars = {
    siteName: cfg.SITE_NAME || 'Takoio',
    nick: '访客昵称',
    title: '文章标题',
    comment: '这是一条测试评论的内容。如果能看到这条消息，说明邮件模板配置正确。',
    url: 'https://example.com',
    ip: '127.0.0.1',
    ua: 'Mozilla/5.0 TestBrowser',
  }
  const html = renderTemplate(rawTpl, vars)
  const result = await sendEmail(emailCfg, renderTemplate(subject, vars), html)

  // Return sanitized result — do not expose full SMTP log to client
  return {
    success: result.success,
    message: result.message,
    messageId: result.messageId,
  }
}
