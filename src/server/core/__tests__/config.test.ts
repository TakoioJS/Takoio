import { describe, it, expect } from 'vitest'
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
  it('excludes SMTP_PASS entirely (PUBLIC_EXCLUDED_KEYS)', () => {
    // 安全策略升级：SMTP 相关字段不再掩码而是完全剔除，避免泄露任何片段
    const cfg = { SMTP_PASS: 'mysecretpassword', SITE_NAME: 'Blog' } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SMTP_PASS).toBeUndefined()
    expect(masked.SITE_NAME).toBe('Blog')
  })

  it('excludes PUSHOO_CHANNELS entirely (PUBLIC_EXCLUDED_KEYS)', () => {
    const cfg = {
      PUSHOO_CHANNELS: '{"serverchan":"SCT123456789","telegram":"bot123456:abcdef"}',
    } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.PUSHOO_CHANNELS).toBeUndefined()
  })

  it('does not mask non-sensitive values', () => {
    const cfg = { SITE_NAME: 'My Blog', PAGE_SIZE: 10 } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SITE_NAME).toBe('My Blog')
    expect(masked.PAGE_SIZE).toBe(10)
  })

  it('handles empty sensitive values', () => {
    // SMTP_PASS 被 PUBLIC_EXCLUDED_KEYS 剔除，即便为空也不在结果中
    const cfg = { SMTP_PASS: '', CAPTCHA_SECRET_KEY: '' } as any
    const masked = maskSensitiveConfig(cfg)
    expect(masked.SMTP_PASS).toBeUndefined()
    // CAPTCHA_SECRET_KEY 在 SENSITIVE_CONFIG_KEYS 中，空值不掩码保留为 ''
    expect(masked.CAPTCHA_SECRET_KEY).toBe('')
  })
})

describe('SENSITIVE_CONFIG_KEYS', () => {
  it('includes SMTP_PASS', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('SMTP_PASS')).toBe(true)
  })

  it('includes PUSHOO_CHANNELS', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('PUSHOO_CHANNELS')).toBe(true)
  })

  it('does not include non-sensitive keys', () => {
    expect(SENSITIVE_CONFIG_KEYS.has('SITE_NAME')).toBe(false)
    expect(SENSITIVE_CONFIG_KEYS.has('PAGE_SIZE')).toBe(false)
  })
})
