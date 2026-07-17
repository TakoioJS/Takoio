import { describe, it, expect } from 'vitest'
import {
  PasswordSetSchema,
  SetConfigSchema,
  LoginSchema,
  CommentIdSchema,
  GetCommentSchema,
  SubmitCommentSchema,
  safeValidate,
} from '../index'

describe('PasswordSetSchema', () => {
  it('should accept a strong password', () => {
    const result = safeValidate(PasswordSetSchema, { password: 'MyPass123!' })
    expect(result.success).toBe(true)
  })

  it('should reject password shorter than 8 chars', () => {
    const result = safeValidate(PasswordSetSchema, { password: 'Ab1!' })
    expect(result.success).toBe(false)
  })

  it('should reject all-digit password', () => {
    const result = safeValidate(PasswordSetSchema, { password: '12345678' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('数字')
  })

  it('should reject all-letter password', () => {
    const result = safeValidate(PasswordSetSchema, { password: 'abcdefgh' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('字母')
  })

  it('should accept mixed letters and digits', () => {
    const result = safeValidate(PasswordSetSchema, { password: 'abcdefg1' })
    expect(result.success).toBe(true)
  })

  it('should reject empty password', () => {
    const result = safeValidate(PasswordSetSchema, { password: '' })
    expect(result.success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('should accept valid password (8+ chars)', () => {
    const result = safeValidate(LoginSchema, { password: 'mypassword' })
    expect(result.success).toBe(true)
  })

  it('should reject short password', () => {
    const result = safeValidate(LoginSchema, { password: 'short' })
    expect(result.success).toBe(false)
  })
})

describe('SetConfigSchema whitelist', () => {
  it('should accept known config keys', () => {
    const result = safeValidate(SetConfigSchema, {
      config: { SITE_NAME: 'My Blog', PAGE_SIZE: 20 },
    })
    expect(result.success).toBe(true)
  })

  it('should reject unknown config keys', () => {
    const result = safeValidate(SetConfigSchema, {
      config: { AUTH_HASH: 'hacked', MALICIOUS_KEY: 'evil' },
    })
    expect(result.success).toBe(false)
  })

  it('should accept PUSHOO_CHANNELS key', () => {
    const result = safeValidate(SetConfigSchema, {
      config: { PUSHOO_CHANNELS: '{"telegram":"bot123:abc"}' },
    })
    expect(result.success).toBe(true)
  })

  it('should reject AUTH_HASH even among valid keys', () => {
    const result = safeValidate(SetConfigSchema, {
      config: { SITE_NAME: 'Blog', AUTH_HASH: 'secret' },
    })
    expect(result.success).toBe(false)
  })

  it('should accept empty config object', () => {
    const result = safeValidate(SetConfigSchema, { config: {} })
    expect(result.success).toBe(true)
  })
})

describe('CommentIdSchema', () => {
  it('should accept valid id', () => {
    const result = safeValidate(CommentIdSchema, { id: 'abc-123' })
    expect(result.success).toBe(true)
  })

  it('should reject empty id', () => {
    const result = safeValidate(CommentIdSchema, { id: '' })
    expect(result.success).toBe(false)
  })

  it('should reject missing id', () => {
    const result = safeValidate(CommentIdSchema, {})
    expect(result.success).toBe(false)
  })
})

describe('GetCommentSchema defaults', () => {
  it('should apply defaults when data is empty', () => {
    const result = safeValidate(GetCommentSchema, {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.url).toBe('/')
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(10)
      expect(result.data.sort).toBe('newest')
    }
  })

  it('should reject invalid sort value', () => {
    const result = safeValidate(GetCommentSchema, { sort: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('should reject negative page', () => {
    const result = safeValidate(GetCommentSchema, { page: -1 })
    expect(result.success).toBe(false)
  })

  it('should reject pageSize over 100', () => {
    const result = safeValidate(GetCommentSchema, { pageSize: 200 })
    expect(result.success).toBe(false)
  })
})

describe('SubmitCommentSchema image field', () => {
  // 安全修复：image 字段原本只校验 max(200)，无协议限制。评论者可直接调 API
  // 设置 image 为任意 URL，所有访客浏览器都会加载该 URL（被动数据外泄/追踪）。
  // 现仅允许 http(s) URL 或 / 开头的相对路径，阻断 javascript:/data: 等危险协议。
  const baseComment = { url: '/', nick: 'A', comment: 'hi' }

  it('should accept http(s) image URLs', () => {
    expect(safeValidate(SubmitCommentSchema, { ...baseComment, image: 'https://cdn.example/a.png' }).success).toBe(true)
    expect(safeValidate(SubmitCommentSchema, { ...baseComment, image: 'http://cdn.example/a.png' }).success).toBe(true)
  })

  it('should accept relative path image URLs', () => {
    expect(safeValidate(SubmitCommentSchema, { ...baseComment, image: '/uploads/a.png' }).success).toBe(true)
  })

  it('should reject javascript: image URLs', () => {
    const r = safeValidate(SubmitCommentSchema, { ...baseComment, image: 'javascript:alert(1)' })
    expect(r.success).toBe(false)
  })

  it('should reject data: image URLs', () => {
    const r = safeValidate(SubmitCommentSchema, { ...baseComment, image: 'data:text/html,<script>alert(1)</script>' })
    expect(r.success).toBe(false)
  })

  it('should allow omitting image (optional)', () => {
    expect(safeValidate(SubmitCommentSchema, baseComment).success).toBe(true)
  })
})
