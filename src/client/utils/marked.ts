import { Marked } from 'marked'
import DOMPurify, { type Config } from 'dompurify'

let markdownInstance: Marked | null = null

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
    'a', 'img', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'hr', 'span', 'div', 'sup', 'sub', 'details', 'summary',
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mspace', 'mover', 'munder',
    'munderover', 'msub', 'msup', 'mfrac', 'msqrt', 'mtable', 'mtr', 'mtd',
    'annotation', 'svg', 'path', 'line', 'rect', 'circle', 'g'
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'href', 'src', 'alt', 'title', 'target', 'rel',
    'width', 'height', 'style',
    'colspan', 'rowspan', 'align', 'valign',
    'aria-hidden', 'role',
    'xmlns', 'encoding', 'mathvariant', 'displaystyle', 'scriptlevel',
    'd', 'viewBox', 'fill', 'stroke', 'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'rx', 'ry', 'r', 'cx', 'cy'
  ],
  ALLOW_DATA_ATTR: false
}

const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

const getMarked = (): Marked => {
  if (!markdownInstance) {
    markdownInstance = new Marked({
      gfm: true,
      breaks: true
    })
  }
  return markdownInstance
}

export const marked = (text: string): string => {
  try {
    const html = getMarked().parse(text) as string
    return sanitizeHtml(html)
  } catch (e) {
    return escapeHtml(text)
  }
}

export const renderMarkdown = async (text: string): Promise<string> => {
  const md = getMarked()
  md.use({
    renderer: {
      code ({ text: code, lang }: { text: string; lang?: string }) {
        return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code)}</code></pre>`
      }
    }
  })
  try {
    const result = md.parse(text) as string
    return sanitizeHtml(result)
  } catch (e) {
    return escapeHtml(text)
  }
}

export default marked