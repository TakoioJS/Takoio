import { describe, it, expect } from 'vitest'
import { renderComment } from '../render'

describe('renderComment — server-side XSS protection', () => {
  it('strips <script> tags', async () => {
    const result = await renderComment('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
  })

  it('strips onerror handler from img tags', async () => {
    const result = await renderComment('<img src=x onerror="alert(1)">')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert')
  })

  it('strips javascript: protocol in markdown links', async () => {
    const result = await renderComment('[click](javascript:alert(1))')
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('alert')
  })

  it('strips javascript: protocol in markdown images', async () => {
    const result = await renderComment('![xss](javascript:alert(1))')
    expect(result).not.toContain('javascript:')
  })

  it('strips iframe tags', async () => {
    const result = await renderComment('<iframe src="evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('drops raw HTML entirely (renderer.html returns empty)', async () => {
    // Raw HTML in markdown is dropped — including element content
    const result = await renderComment('<div onmouseover="alert(1)">hover</div>')
    expect(result).not.toContain('onmouseover')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('<div')
  })

  it('strips form elements', async () => {
    const result = await renderComment('<form action="evil.com"><input type="submit"></form>')
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('drops inline style attributes with raw HTML', async () => {
    // Raw HTML dropped entirely — style attribute never reaches output
    const result = await renderComment('<div style="background:url(javascript:alert(1))">styled</div>')
    expect(result).not.toContain('style=')
    expect(result).not.toContain('javascript:')
  })

  it('drops data-* attributes with raw HTML', async () => {
    const result = await renderComment('<div data-evil="payload">content</div>')
    expect(result).not.toContain('data-evil')
    expect(result).not.toContain('<div')
  })

  it('allows safe markdown bold and italic', async () => {
    const result = await renderComment('**bold** and *italic*')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })

  it('allows safe https links', async () => {
    const result = await renderComment('[link](https://example.com)')
    expect(result).toContain('href="https://example.com"')
  })

  it('allows safe http links', async () => {
    const result = await renderComment('[link](http://example.com)')
    expect(result).toContain('href="http://example.com"')
  })

  it('allows safe image with https src', async () => {
    const result = await renderComment('![alt](https://example.com/img.png)')
    expect(result).toContain('<img')
    expect(result).toContain('src="https://example.com/img.png"')
  })

  it('blocks javascript: image src by converting to link', async () => {
    const result = await renderComment('![xss](javascript:alert(1))')
    // isSafeImageUrl returns false for javascript:, so renderer outputs <a> not <img>
    expect(result).not.toContain('src="javascript:')
  })

  it('handles markdown tables', async () => {
    const result = await renderComment('| a | b |\n|---|---|\n| 1 | 2 |')
    expect(result).toContain('<table')
    expect(result).toContain('<td>')
  })

  it('handles empty string input', async () => {
    const result = await renderComment('')
    expect(typeof result).toBe('string')
  })

  it('does not leak inline raw HTML', async () => {
    // Raw HTML in markdown should be dropped (renderer.html returns '')
    const result = await renderComment('<div>raw html</div>')
    expect(result).not.toContain('<div>raw html</div>')
  })

  it('blocks SVG with embedded script tag', async () => {
    const result = await renderComment('<svg><script>alert(1)</script></svg>')
    // Raw HTML dropped, script tag never rendered as element
    expect(result).not.toContain('<script')
    expect(result).not.toContain('<svg')
  })

  it('escapes markdown link href with javascript protocol', async () => {
    const result = await renderComment('[click](javascript:alert(document.cookie))')
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('document.cookie')
  })
})
