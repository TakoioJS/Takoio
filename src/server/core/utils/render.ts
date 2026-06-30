import { Marked } from 'marked'
import { createHighlighter } from 'shiki'
// @ts-expect-error jsdom has no type declarations
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'

// Lazily initialize DOMPurify — JSDOM uses __dirname internally which
// is undefined in ESM bundled builds (Nitro production). Lazy init
// defers the crash until actually needed, and we polyfill __dirname.
let purify: ReturnType<typeof DOMPurify> | null = null
async function initPurify () {
  if (purify) return purify
  const { window } = new JSDOM('')
  purify = DOMPurify(window)
  return purify
}

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null
let hlPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function getHl () {
  if (highlighter) return highlighter
  if (hlPromise) return hlPromise
  hlPromise = createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [
      'javascript', 'typescript', 'tsx', 'jsx', 'html', 'css', 'scss',
      'json', 'yaml', 'markdown', 'bash', 'python', 'go',
      'java', 'kotlin', 'rust', 'sql', 'dockerfile', 'nginx',
      'shell', 'vue', 'graphql', 'xml', 'diff', 'makefile', 'toml', 'text',
    ],
  })
  highlighter = await hlPromise
  return highlighter
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
    'a', 'img', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'hr', 'span', 'div', 'sup', 'sub', 'details', 'summary',
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'mspace', 'mover', 'munder',
    'munderover', 'msub', 'msup', 'mfrac', 'msqrt', 'mtable', 'mtr', 'mtd',
    'annotation',
    'svg', 'path', 'line', 'rect', 'circle', 'g',
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'href', 'src', 'alt', 'title', 'target', 'rel',
    'width', 'height',
    'colspan', 'rowspan', 'align', 'valign',
    'aria-hidden', 'role',
    'xmlns', 'encoding', 'mathvariant', 'displaystyle', 'scriptlevel',
    'd', 'viewBox', 'fill', 'stroke', 'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'rx', 'ry', 'r', 'cx', 'cy',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'],
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isSafeImageUrl = (href: string): boolean => {
  try {
    const u = new URL(href)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:'
  } catch {
    return false
  }
}

export async function renderComment (text: string): Promise<string> {
  const p = await initPurify()
  const hl = await getHl()
  const md = new Marked({ gfm: true, breaks: true })
  md.use({
    renderer: {
      html (_token) { return '' },
    },
  })
  md.use({
    async: true,
    renderer: {
      code ({ text: code, lang }: { text: string; lang?: string }) {
        try {
          return hl.codeToHtml(code, { lang: lang || 'text', theme: 'github-light' })
        } catch {
          return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code)}</code></pre>`
        }
      },
    },
  })
  md.use({
    renderer: {
      image ({ href, title, text }: { href: string; title: string | null; text: string }) {
        if (!isSafeImageUrl(href)) {
          return `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(text || 'image')}</a>`
        }
        const safeHref = escapeHtml(href)
        const safeText = escapeHtml(text)
        const safeTitle = escapeHtml(title || text || '')
        const isEmoji = href.includes('twemoji') || href.includes('iconify') || href.includes('emoji') || text.endsWith('图片') || text.endsWith('表情')
        if (isEmoji) {
          return `<img src="${safeHref}" alt="${safeText}" title="${safeTitle}" class="tk-owo-emotion" />`
        }
        return `<img src="${safeHref}" alt="${safeText}" title="${safeTitle}" class="tk-comment-inline-image" />`
      }
    }
  })
  const html = await md.parse(text)
  return p.sanitize(html, PURIFY_CONFIG)
}
