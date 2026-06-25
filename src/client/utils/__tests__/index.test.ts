import { describe, it, expect } from 'vitest'
import { isUrl, isNotSet, convertLink, isQQ, getQQAvatar, normalizeMail } from '../index'

describe('isUrl', () => {
  it('returns true for http urls', () => {
    expect(isUrl('http://example.com')).toBe(true)
  })

  it('returns true for https urls', () => {
    expect(isUrl('https://example.com')).toBe(true)
  })

  it('returns false for empty strings', () => {
    expect(isUrl('')).toBe(false)
  })

  it('returns false for non-url strings', () => {
    expect(isUrl('hello')).toBe(false)
  })
})

describe('isNotSet', () => {
  it('returns true for undefined', () => {
    expect(isNotSet(undefined)).toBe(true)
  })

  it('returns true for null', () => {
    expect(isNotSet(null)).toBe(true)
  })

  it('returns true for empty string', () => {
    expect(isNotSet('')).toBe(true)
  })

  it('returns false for valid values', () => {
    expect(isNotSet('hello')).toBe(false)
    expect(isNotSet(0)).toBe(false)
    expect(isNotSet(false)).toBe(false)
  })
})

describe('convertLink', () => {
  it('adds http:// prefix if missing', () => {
    expect(convertLink('example.com')).toBe('http://example.com')
  })

  it('keeps existing http prefix', () => {
    expect(convertLink('http://example.com')).toBe('http://example.com')
  })

  it('keeps existing https prefix', () => {
    expect(convertLink('https://example.com')).toBe('https://example.com')
  })

  it('returns empty string for empty input', () => {
    expect(convertLink('')).toBe('')
  })
})

describe('isQQ', () => {
  it('returns true for valid QQ numbers', () => {
    expect(isQQ('123456')).toBe(true)
    expect(isQQ('10001')).toBe(true)
  })

  it('returns false for invalid QQ numbers', () => {
    expect(isQQ('123')).toBe(false)
    expect(isQQ('abc')).toBe(false)
  })
})

describe('getQQAvatar', () => {
  it('returns correct URL', () => {
    expect(getQQAvatar('123456')).toBe('https://q1.qlogo.cn/g?b=qq&nk=123456&s=100')
  })
})

describe('normalizeMail', () => {
  it('trims and lowercases email', () => {
    expect(normalizeMail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeMail('')).toBe('')
  })
})
