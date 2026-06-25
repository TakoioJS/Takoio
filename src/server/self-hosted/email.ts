import nodemailer from 'nodemailer'
import { logger } from './utils/logger'

export interface EmailConfig {
  SMTP_HOST?: string
  SMTP_PORT?: number
  SMTP_USER?: string
  SMTP_PASS?: string
  SMTP_FROM?: string
  SMTP_TO?: string
  SMTP_TLS?: boolean
}

export async function sendEmail (
  config: EmailConfig,
  subject: string,
  html: string
): Promise<{ success: boolean; message: string }> {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    return { success: false, message: 'SMTP 未配置' }
  }

  try {
    const port = config.SMTP_PORT || 587
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port,
      secure: config.SMTP_TLS ?? (port === 465),
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    })

    await transporter.sendMail({
      from: config.SMTP_FROM || config.SMTP_USER,
      to: config.SMTP_TO || config.SMTP_USER,
      subject,
      html,
    })

    logger.info({ to: config.SMTP_TO || config.SMTP_USER, subject }, 'Email sent')
    return { success: true, message: '邮件发送成功' }
  } catch (e: any) {
    logger.error({ error: e.message }, 'Email send failed')
    return { success: false, message: `邮件发送失败: ${e.message}` }
  }
}
