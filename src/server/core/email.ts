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

export interface EmailLogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface SendEmailResult {
  success: boolean
  message: string
  log: EmailLogEntry[]
  messageId?: string
  response?: string
}

function createLogger () {
  const log: EmailLogEntry[] = []
  const now = () => Date.now()
  return {
    log,
    info (message: string) {
      log.push({ time: now(), level: 'info', message })
      logger.info(`[email] ${message}`)
    },
    warn (message: string) {
      log.push({ time: now(), level: 'warn', message })
      logger.warn(`[email] ${message}`)
    },
    error (message: string) {
      log.push({ time: now(), level: 'error', message })
      logger.error(`[email] ${message}`)
    },
  }
}

export async function sendEmail (
  config: EmailConfig,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const logger = createLogger()

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    logger.warn('SMTP 未配置：缺少 HOST/USER/PASS')
    return { success: false, message: 'SMTP 未配置', log: logger.log }
  }

  try {
    const port = config.SMTP_PORT || 587
    const secure = config.SMTP_TLS ?? (port === 465)
    logger.info(`连接 SMTP ${config.SMTP_HOST}:${port} (TLS=${secure})`)

    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port,
      secure,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    })

    // Verify connection before sending
    logger.info('验证 SMTP 连接...')
    try {
      await transporter.verify()
      logger.info('SMTP 连接验证成功')
    } catch (verifyErr: any) {
      logger.error(`SMTP 连接验证失败: ${verifyErr.message}`)
      // Continue anyway — verify() can fail on some servers that still work for send
    }

    const from = config.SMTP_FROM || config.SMTP_USER
    const to = config.SMTP_TO || config.SMTP_USER
    logger.info(`发送邮件至 ${to}，主题: ${subject}`)

    const start = Date.now()
    const result = await transporter.sendMail({ from, to, subject, html })
    const elapsed = Date.now() - start

    logger.info(`邮件发送成功 (${elapsed}ms) messageId=${result.messageId}`)

    return {
      success: true,
      message: '邮件发送成功',
      log: logger.log,
      messageId: result.messageId,
      response: result.response,
    }
  } catch (e: any) {
    logger.error(`邮件发送失败: ${e.message}`)
    return { success: false, message: `邮件发送失败: ${e.message}`, log: logger.log }
  }
}
