import { describe, it, expect, vi, beforeEach } from 'vitest'
import { maskSensitiveValue, maskSensitiveConfig, SENSITIVE_CONFIG_KEYS } from '../config'

describe('maskSensitiveValue', () => {
  it('masks values longer than 7 chars', () => {
    expect(maskSensitiveValue('abcdefghijk')).toBe('abc****hijk')
  })

  it('returns **** for short values', () => {
    expect(maskSensitiveValue('abc')).toBe('****')
    expect(maskSensitiveValue('abcdefg')).toBe('****')
  })

  it('returns **** for empty values', () => {
    expect(maskSensitiveValue('')).toBe('****')
  })

  it('preserves first 3 and last 4 chars', () => {
    expect(maskSensitiveValue('1234567890')).toBe('123****7890')
  })
})

describe('maskSensitiveConfig', () => {
  it('masks SMTP_PASS', () => {
    const cfg = { SMTP_PASS: 'mysecretpassword', SITE_NAME: 'Blog' } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SMTP_PASS).toBe('mys****word')
    expect(masked.SITE_NAME).toBe('Blog')
  })

  it('masks all Pushoo tokens', () => {
    const cfg = {
      PUSHOO_TELEGRAM_TOKEN: 'bot123456:abcdef',
      PUSHOO_SC_KEY: 'SCT123456789',
    } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.PUSHOO_TELEGRAM_TOKEN).not.toBe('bot123456:abcdef')
    expect(masked.PUSHOO_SC_KEY).not.toBe('SCT123456789')
  })

  it('does not mask non-sensitive values', () => {
    const cfg = { SITE_NAME: 'My Blog', PAGE_SIZE: 10 } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SITE_NAME).toBe('My Blog')
    expect(masked.PAGE_SIZE).toBe(10)
  })

  it('handles empty sensitive values', () => {
    const cfg = { SMTP_PASS: '', CAPTCHA_SECRET_KEY: '' } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SMTP_PASS).toBe('')
    expect(masked.CAPTCHA_SECRET_KEY).toBe('')
  })
})

describe('SENSITIVE_CONFIG_KEYS', () => {
  it('includes SMTP_PASS', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('SMTP_PASS')).toBe(true)
  })

  it('includes all Pushoo tokens', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('PUSHOO_TELEGRAM_TOKEN')).toBe(true)
    expect(SENSITIVE_CONFIG_KEYS.has('PUSHOO_DISCORD_TOKEN')).toBe(true)
    expect(SENSITIVE_CONFIG_KEYS.has('PUSHOO_WEBHOOK_TOKEN')).toBe(true)
  })

  it('does not include non-sensitive keys', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('SITE_NAME')).toBe(false)
    expect(SENSITIVE_CONFIG_KEYS.has('PAGE_SIZE')).toBe(false)
  })
})
