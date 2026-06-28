import { describe, it, expect, vi } from 'vitest'
import { sendEmail } from '../email'

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('sendEmail', () => {
  it('returns error when SMTP is not configured', async () => {
    const result = await sendEmail(
      { SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' },
      'Test Subject',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
    expect(result.message).toBe('SMTP 未配置')
  })

  it('returns error when SMTP_HOST is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: '', SMTP_USER: 'user@test.com', SMTP_PASS: 'pass' },
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })

  it('returns error when SMTP_USER is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: 'smtp.test.com', SMTP_USER: '', SMTP_PASS: 'pass' },
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })

  it('returns error when SMTP_PASS is missing', async () => {
    const result = await sendEmail(
      { SMTP_HOST: 'smtp.test.com', SMTP_USER: 'user@test.com', SMTP_PASS: '' },
      'Test',
      '<p>Test</p>'
    )
    expect(result.success).toBe(false)
  })
})
