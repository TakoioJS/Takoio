/**
 * useFormValidation 测试
 */
import { describe, it, expect } from 'vitest'
import { useFormValidation } from '../useFormValidation'

describe('useFormValidation', () => {
  const baseOptions = {
    options: { enableLinkInput: true } as any,
    siteConfig: { REQUIRED_FIELDS: ['nick', 'mail'] },
    form: { nick: '', mail: '', link: '', comment: '' },
  }

  it('validates required fields', () => {
    const { errors, validate } = useFormValidation(baseOptions)
    const ok = validate((k) => k)
    expect(ok).toBe(false)
    expect(errors.nick).toBeTruthy()
    expect(errors.mail).toBeTruthy()
    expect(errors.comment).toBeTruthy()
  })

  it('passes when all fields are filled', () => {
    const { errors, validate } = useFormValidation({
      ...baseOptions,
      form: { nick: 'Alice', mail: 'a@b.com', link: '', comment: 'hello' },
    })
    const ok = validate((k) => k)
    expect(ok).toBe(true)
    expect(errors.nick).toBe('')
  })

  it('validates email format', () => {
    const { errors, validate } = useFormValidation({
      ...baseOptions,
      form: { nick: 'Alice', mail: 'invalid-email', link: '', comment: 'hello' },
    })
    const ok = validate((k) => k)
    expect(ok).toBe(false)
    expect(errors.mail).toBeTruthy()
  })

  it('skips nick requirement when not in REQUIRED_FIELDS', () => {
    const { errors, validate } = useFormValidation({
      ...baseOptions,
      siteConfig: { REQUIRED_FIELDS: ['mail'] },
      form: { nick: '', mail: 'a@b.com', link: '', comment: 'hello' },
    })
    const ok = validate((k) => k)
    expect(ok).toBe(true)
    expect(errors.nick).toBe('')
  })

  it('requires link only when enableLinkInput and in REQUIRED_FIELDS', () => {
    const { errors, validate } = useFormValidation({
      ...baseOptions,
      options: { enableLinkInput: false } as any,
      siteConfig: { REQUIRED_FIELDS: ['nick', 'mail', 'link'] },
      form: { nick: 'Alice', mail: 'a@b.com', link: '', comment: 'hello' },
    })
    const ok = validate((k) => k)
    // enableLinkInput=false → link not required
    expect(ok).toBe(true)
  })
})