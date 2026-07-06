import { describe, it, expect, vi } from 'vitest'
import { sendEmail } from '../email'
import { logger } from '../utils/logger'

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('sendEmail', () => {
  it('returns error when SMTP is not configured', async () => {
    const result = await sendEmail(
      { SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' },
      'test@test.com',
      'Test Subject',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
    expect(result.message).toBe('SMTP 未配置')
  })

  it('returns error when SMTP_HOST is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: '', SMTP_USER: 'user@test.com', SMTP_PASS: 'pass' },
      'test@test.com',
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })

  it('returns error when SMTP_USER is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: 'smtp.test.com', SMTP_USER: '', SMTP_PASS: 'pass' },
      'test@test.com',
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })

  it('returns error when SMTP_PASS is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: 'smtp.test.com', SMTP_USER: 'user@test.com', SMTP_PASS: '' },
      'test@test.com',
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })

  it('does not log recipient email address', async () => {
    // 即使成功路径走到日志点，nodemailer 没有真实服务器会抛错进入 catch，
    // 但日志在 sendMail 之前已经打印，足够验证收件人是否被脱敏
    await sendEmail(
      { SMTP_HOST: 'smtp.test.com', SMTP_USER: 'user@test.com', SMTP_PASS: 'pass' },
      'user@example.com',
      'Secret Subject',
      '<p>Test</p>'
    )
    const infoCalls = vi.mocked(logger.info).mock.calls.map(c => c[0])
    const logText = infoCalls.join('\n')
    expect(logText).not.toContain('user@example.com')
    expect(logText).toContain('[REDACTED]')
    expect(logText).toContain('Secret Subject')
  })
})
