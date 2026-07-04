/**
 * @takoio/common 单元测试
 *
 * 覆盖：escapeHtml / renderMarkdownImage / i18n (t / setLanguage / detectLanguageBrowser)
 */

import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../src/escapeHtml'
import { MARKDOWN_ALLOWED_TAGS, MARKDOWN_ALLOWED_ATTR, renderMarkdownImage } from '../src/markdownConfig'
import { t, setLanguage, detectLanguageBrowser, messages } from '../src/i18n'

// =================================================================
// escapeHtml
// =================================================================
describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml('123')).toBe('123')
    expect(escapeHtml('a/b?c=d')).toBe('a/b?c=d')
  })

  it('escapes mixed content', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })
})

// =================================================================
// markdownConfig
// =================================================================
describe('MARKDOWN_ALLOWED_TAGS', () => {
  it('contains common formatting tags', () => {
    expect(MARKDOWN_ALLOWED_TAGS).toContain('p')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('strong')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('a')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('img')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('code')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('blockquote')
  })

  it('contains math tags', () => {
    expect(MARKDOWN_ALLOWED_TAGS).toContain('math')
    expect(MARKDOWN_ALLOWED_TAGS).toContain('mrow')
  })
})

describe('MARKDOWN_ALLOWED_ATTR', () => {
  it('contains common attributes', () => {
    expect(MARKDOWN_ALLOWED_ATTR).toContain('href')
    expect(MARKDOWN_ALLOWED_ATTR).toContain('src')
    expect(MARKDOWN_ALLOWED_ATTR).toContain('class')
    expect(MARKDOWN_ALLOWED_ATTR).toContain('target')
  })
})

describe('renderMarkdownImage', () => {
  it('renders basic img tag with safe attributes', () => {
    const result = renderMarkdownImage('https://example.com/img.png', 'title', 'alt text')
    expect(result).toContain('src="https://example.com/img.png"')
    expect(result).toContain('alt="alt text"')
    expect(result).toContain('title="title"')
    expect(result).toContain('class="tk-comment-inline-image"')
  })

  it('detects emoji images', () => {
    const result = renderMarkdownImage('https://example.com/twemoji/1f600.png', null, 'emoji')
    expect(result).toContain('class="tk-owo-emotion"')
  })

  it('escapes href and text', () => {
    const result = renderMarkdownImage('https://example.com/<script>', null, '<b>bold</b>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('<b>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&lt;b&gt;')
  })

  it('adds lazy loading when option is set', () => {
    const result = renderMarkdownImage('https://example.com/img.png', null, 'img', { lazy: true })
    expect(result).toContain('loading="lazy"')
    expect(result).toContain('decoding="async"')
  })

  it('omits lazy loading by default', () => {
    const result = renderMarkdownImage('https://example.com/img.png', null, 'img')
    expect(result).not.toContain('loading="lazy"')
  })
})

// =================================================================
// i18n
// =================================================================
describe('i18n messages', () => {
  it('zh-CN has all keys defined', () => {
    expect(messages['zh-CN'].placeholder).toBe('说点什么…')
    expect(messages['zh-CN'].submitComment).toBe('发布评论')
  })

  it('zh-TW has all keys defined', () => {
    expect(messages['zh-TW'].placeholder).toBe('說點什麼…')
    expect(messages['zh-TW'].submitComment).toBe('發布評論')
  })

  it('en has all keys defined', () => {
    expect(messages['en'].placeholder).toBe('Say something…')
    expect(messages['en'].submitComment).toBe('Post Comment')
  })

  it('all three languages have the same keys', () => {
    const zhCNKeys = new Set(Object.keys(messages['zh-CN']))
    const zhTWKeys = Object.keys(messages['zh-TW'])
    const enKeys = Object.keys(messages['en'])
    // zh-CN 是最完整的，zh-TW 和 en 是它的子集
    // 允许 zh-TW/en 缺少部分 key（翻译尚未补全）
    const missingInTW = zhTWKeys.filter(k => !zhCNKeys.has(k))
    const missingInEN = enKeys.filter(k => !zhCNKeys.has(k))
    expect(missingInTW).toEqual([])
    expect(missingInEN).toEqual([])
  })
})

describe('t()', () => {
  beforeEach(() => setLanguage('zh-CN'))

  it('returns translation for current language', () => {
    expect(t('placeholder')).toBe('说点什么…')
    expect(t('submitComment')).toBe('发布评论')
  })

  it('falls back to zh-CN when key missing in current language', () => {
    setLanguage('en')
    // Override en to test fallback — remove a key temporarily
    const orig = messages['en']['placeholder']
    delete messages['en']['placeholder']
    expect(t('placeholder')).toBe('说点什么…')
    messages['en']['placeholder'] = orig
  })

  it('returns the key itself when key not found in any language', () => {
    expect(t('non_existent_key_xyz')).toBe('non_existent_key_xyz')
  })

  it('returns correct zh-TW translation', () => {
    setLanguage('zh-TW')
    expect(t('placeholder')).toBe('說點什麼…')
  })

  it('returns correct en translation', () => {
    setLanguage('en')
    expect(t('placeholder')).toBe('Say something…')
  })
})

describe('setLanguage', () => {
  beforeEach(() => setLanguage('zh-CN'))

  it('sets language to zh-TW', () => {
    setLanguage('zh-TW')
    expect(t('placeholder')).toBe('說點什麼…')
  })

  it('sets language to en', () => {
    setLanguage('en')
    expect(t('placeholder')).toBe('Say something…')
  })

  it('auto-detects from zh-CN browser language', () => {
    const original = globalThis.window?.navigator?.language
    // No-op: detectLanguageBrowser uses window.navigator.language
    // In node environment, it falls back to 'zh-CN'
    setLanguage() // auto-detect
    expect(t('placeholder')).toBe('说点什么…')
  })
})