import { Marked } from 'marked'
import { createHighlighter } from 'shiki'
import DOMPurify from 'dompurify'

// ponytail: dynamic import for jsdom — the package is externalized in nitro.config.ts
// because it reads default-stylesheet.css via __dirname at module load time,
// which breaks when bundled into ESM. Dynamic import inside initPurify() ensures
// admin APIs (which import comment.ts → render.ts) don't trigger jsdom loading.
// On serverless platforms (Vercel/Netlify) where node_modules is unavailable,
// the import fails gracefully and comment rendering degrades (frontend renders instead).
// @ts-expect-error jsdom has no type declarations
type JSDOMType = typeof import('jsdom')['JSDOM']

// Lazily initialize DOMPurify — JSDOM uses __dirname internally which
// is undefined in ESM bundled builds (Nitro production). Lazy init
// defers the crash until actually needed, and we polyfill __dirname.
let purify: ReturnType<typeof DOMPurify> | null = null
// True once jsdom import has failed — avoids retrying the import on every call
let _jsdomUnavailable = false
async function initPurify () {
  if (purify) return purify
  if (_jsdomUnavailable) {
    throw new Error('DOMPurify unavailable: jsdom package not found')
  }
  try {
    // Dynamic import — jsdom is externalized in nitro.config.ts.
    const { JSDOM } = await import('jsdom') as { JSDOM: JSDOMType }
    const { window } = new JSDOM('')
    purify = DOMPurify(window)
    return purify
  } catch (e: any) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find package/.test(e?.message || '')) {
      _jsdomUnavailable = true
    }
    throw e
  }
}

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null
let hlPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null = null

// 常用语言在 createHighlighter 时预热；罕见语言按需 loadLanguage，减少冷启动时间
const COMMON_LANGS = [
  'javascript', 'typescript', 'html', 'css', 'json', 'yaml',
  'markdown', 'bash', 'python', 'go', 'java', 'rust', 'sql', 'xml', 'text',
]
const ALL_KNOWN_LANGS = new Set([
  ...COMMON_LANGS,
  'tsx', 'jsx', 'scss', 'kotlin', 'dockerfile', 'nginx',
  'shell', 'vue', 'graphql', 'diff', 'makefile', 'toml',
])
const loadedLangs = new Set<string>()

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function getHl () {
  if (highlighter) return highlighter
  if (hlPromise) return hlPromise
  hlPromise = createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: COMMON_LANGS,
  })
  highlighter = await hlPromise
  for (const lang of COMMON_LANGS) loadedLangs.add(lang)
  return highlighter
}

/** 按需加载未预热的语言 */
async function ensureLang (hl: Awaited<ReturnType<typeof createHighlighter>>, lang: string): Promise<void> {
  if (loadedLangs.has(lang) || !ALL_KNOWN_LANGS.has(lang)) return
  try {
    await hl.loadLanguage(lang as any)
    loadedLangs.add(lang)
  } catch { /* 语言不存在，忽略 */ }
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
      async code ({ text: code, lang }: { text: string; lang?: string }) {
        const language = (lang || 'text').toLowerCase()
        try {
          await ensureLang(hl, language)
          return hl.codeToHtml(code, { lang: language, theme: 'github-light' })
        } catch {
          return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`
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
