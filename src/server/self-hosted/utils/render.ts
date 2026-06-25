import { Marked } from 'marked'
import { getHighlighter, type Highlighter } from 'shiki'

let highlighter: Highlighter | null = null
let hlPromise: Promise<Highlighter> | null = null

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function getHl() {
  if (highlighter) return highlighter
  if (hlPromise) return hlPromise
  hlPromise = getHighlighter({
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

export async function renderComment(text: string): Promise<string> {
  const hl = await getHl()
  const md = new Marked({ gfm: true, breaks: true })
  md.use({
    renderer: {
      html(_token) { return '' },
    },
  })
  md.use({
    async: true,
    renderer: {
      code({ text: code, lang }: { text: string; lang?: string }) {
        try {
          return hl.codeToHtml(code, { lang: lang || 'text', theme: 'github-light' })
        } catch {
          return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code)}</code></pre>`
        }
      },
    },
  })
  return await md.parse(text)
}