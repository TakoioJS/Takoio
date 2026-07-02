/**
 * Shared Markdown/DOMPurify configuration used by both client and server renderers.
 */

import { escapeHtml } from './escapeHtml'

/** Common tag whitelist for rendered comment HTML. */
export const MARKDOWN_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'a', 'img', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'hr', 'span', 'div', 'sup', 'sub', 'details', 'summary',
  'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mspace', 'mover', 'munder',
  'munderover', 'msub', 'msup', 'mfrac', 'msqrt', 'mtable', 'mtr', 'mtd', 'annotation'
]

/** Common attribute whitelist for rendered comment HTML. */
export const MARKDOWN_ALLOWED_ATTR = [
  'class', 'id', 'href', 'src', 'alt', 'title', 'target', 'rel',
  'width', 'height',
  'colspan', 'rowspan', 'align', 'valign',
  'aria-hidden', 'role',
  'xmlns', 'encoding', 'mathvariant', 'displaystyle', 'scriptlevel'
]

export interface MarkdownImageOptions {
  /** Add loading="lazy" decoding="async" attributes (client-side only). */
  lazy?: boolean
}

/** Render a markdown image token with consistent escaping and emoji detection. */
export function renderMarkdownImage (
  href: string,
  title: string | null,
  text: string,
  options: MarkdownImageOptions = {}
): string {
  const safeHref = escapeHtml(href)
  const safeText = escapeHtml(text)
  const safeTitle = escapeHtml(title || text || '')
  const isEmoji = href.includes('twemoji') || href.includes('iconify') || href.includes('emoji') || text.endsWith('图片') || text.endsWith('表情')
  const cls = isEmoji ? 'tk-owo-emotion' : 'tk-comment-inline-image'
  const lazy = options.lazy ? ' loading="lazy" decoding="async"' : ''
  return `<img src="${safeHref}" alt="${safeText}" title="${safeTitle}" class="${cls}"${lazy} />`
}
