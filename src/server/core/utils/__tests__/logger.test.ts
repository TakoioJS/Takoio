import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../logger'

describe('logger redaction', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('redacts sensitive config keys in object metadata', () => {
    logger.info({ SMTP_PASS: 'secret123', SITE_NAME: 'Blog' }, 'config update')
    const output = stdoutSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('secret123')
    expect(output).toContain('Blog')
  })

  it('redacts nested sensitive values', () => {
    logger.info({ nested: { CAPTCHA_SECRET_KEY: 'captcha-secret' } }, 'nested data')
    const output = stdoutSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('captcha-secret')
  })

  it('does not alter non-sensitive values', () => {
    logger.info({ PAGE_SIZE: 10, COMMENT_SORT: 'newest' }, 'public config')
    const output = stdoutSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('10')
    expect(output).toContain('newest')
  })
})
