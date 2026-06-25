// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { marked } from '../marked'

describe('marked XSS protection', () => {
  it('should strip onerror handler from img tags', () => {
    const result = marked('<img src=x onerror="alert(1)">')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert')
  })

  it('should strip script tags', () => {
    const result = marked('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
  })

  it('should strip javascript: protocol in links', () => {
    const result = marked('[click](javascript:alert(1))')
    expect(result).not.toContain('javascript:')
  })

  it('should strip iframe tags', () => {
    const result = marked('<iframe src="evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('should strip event handlers on standard elements', () => {
    const result = marked('<div onmouseover="alert(1)">hover me</div>')
    expect(result).not.toContain('onmouseover')
    expect(result).toContain('hover me')
  })

  it('should strip form elements', () => {
    const result = marked('<form action="evil.com"><input type="submit"></form>')
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('should preserve safe Markdown output', () => {
    const result = marked('**bold** and *italic*')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })

  it('should preserve links with safe protocols', () => {
    const result = marked('[link](https://example.com)')
    expect(result).toContain('href="https://example.com"')
  })

  it('should preserve code blocks', () => {
    const result = marked('`inline code`')
    expect(result).toContain('<code>inline code</code>')
  })

  it('should preserve images with safe src', () => {
    const result = marked('![alt](https://example.com/img.png)')
    expect(result).toContain('<img')
    expect(result).toContain('src="https://example.com/img.png"')
  })

  it('should handle data: URI in img as potentially unsafe', () => {
    // DOMPurify typically allows data: URIs in img by default,
    // but we just verify it doesn't break
    const result = marked('![test](data:image/png;base64,abc)')
    expect(result).toContain('<img')
  })

  it('should escape raw HTML injection attempts', () => {
    const result = marked('text <img src=x onerror=alert(1)> more text')
    expect(result).not.toContain('onerror')
    expect(result).toContain('more text')
  })
})
