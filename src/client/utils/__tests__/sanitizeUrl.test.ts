// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeUrl } from '../index'

describe('sanitizeUrl — XSS protocol guard', () => {
  it('allows http URLs unchanged', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('allows https URLs unchanged', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/')
  })

  it('blocks javascript: protocol and returns #', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#')
  })

  it('blocks data: protocol (with text content)', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#')
  })

  it('blocks file: protocol', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBe('#')
  })

  it('blocks vbscript: protocol', () => {
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#')
  })

  it('prepends https:// to bare domain without protocol', () => {
    // bare domain: URL constructor throws → catch branch returns `https://${url}` (no normalization)
    expect(sanitizeUrl('example.com')).toBe('https://example.com')
  })

  it('prepends https:// to path-like URL', () => {
    expect(sanitizeUrl('example.com/path?q=1')).toBe('https://example.com/path?q=1')
  })

  it('preserves query string and hash in https URLs', () => {
    expect(sanitizeUrl('https://example.com/path?q=1#hash')).toBe('https://example.com/path?q=1#hash')
  })

  it('handles URLs with ports', () => {
    expect(sanitizeUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path')
  })

  it('blocks malformed protocol-like strings', () => {
    // Has a scheme-like prefix but not a real URL — should return '#'
    expect(sanitizeUrl('evil:notarealprotocol')).toBe('#')
  })

  it('handles empty string by returning https://', () => {
    // Empty string: URL constructor throws, regex doesn't match, falls to https://
    expect(sanitizeUrl('')).toBe('https://')
  })

  it('blocks mixed-case javascript: protocol', () => {
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBe('#')
  })

  it('blocks javascript with embedded whitespace', () => {
    // URL parser normalizes to javascript: → blocked
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#')
  })
})
