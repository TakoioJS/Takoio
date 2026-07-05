import type { Marked } from 'marked'
import type DOMPurify from 'dompurify'
import type { Config } from 'dompurify'
import { escapeHtml, MARKDOWN_ALLOWED_TAGS, MARKDOWN_ALLOWED_ATTR, renderMarkdownImage } from '@takoio/common'

// highlight.js is lazy-loaded on first code block render
type HljsCore = typeof import('highlight.js/lib/core').default
let _hljs: HljsCore | null = null
let _hljsReady = false

const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return resolve()
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`))
    document.head.appendChild(script)
  })
}

let hljsLoadingPromise: Promise<HljsCore | null> | null = null

async function getHljs (): Promise<HljsCore | null> {
  if (_hljsReady) return _hljs
  if (typeof window === 'undefined') return null

  if ((window as any).hljs) {
    _hljs = (window as any).hljs
    _hljsReady = true
    return _hljs
  }

  if (typeof __UMD__ !== 'undefined' && __UMD__) {
    if (hljsLoadingPromise) return hljsLoadingPromise
    hljsLoadingPromise = (async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js')
        _hljs = (window as any).hljs || null
      } catch {
        // ignore
      }
      _hljsReady = true
      hljsLoadingPromise = null
      return _hljs
    })()
    return hljsLoadingPromise
  }

  try {
    const [coreMod, jsMod, tsMod, pyMod, goMod, rustMod, javaMod, cssMod, scssMod, sqlMod, bashMod, jsonMod, yamlMod, xmlMod, mdMod, diffMod] = await Promise.all([
      import('highlight.js/lib/core'),
      import('highlight.js/lib/languages/javascript'),
      import('highlight.js/lib/languages/typescript'),
      import('highlight.js/lib/languages/python'),
      import('highlight.js/lib/languages/go'),
      import('highlight.js/lib/languages/rust'),
      import('highlight.js/lib/languages/java'),
      import('highlight.js/lib/languages/css'),
      import('highlight.js/lib/languages/scss'),
      import('highlight.js/lib/languages/sql'),
      import('highlight.js/lib/languages/bash'),
      import('highlight.js/lib/languages/json'),
      import('highlight.js/lib/languages/yaml'),
      import('highlight.js/lib/languages/xml'),
      import('highlight.js/lib/languages/markdown'),
      import('highlight.js/lib/languages/diff'),
    ])
    const hljs = coreMod.default
    hljs.registerLanguage('javascript', jsMod.default)
    hljs.registerLanguage('js', jsMod.default)
    hljs.registerLanguage('typescript', tsMod.default)
    hljs.registerLanguage('ts', tsMod.default)
    hljs.registerLanguage('python', pyMod.default)
    hljs.registerLanguage('py', pyMod.default)
    hljs.registerLanguage('go', goMod.default)
    hljs.registerLanguage('rust', rustMod.default)
    hljs.registerLanguage('rs', rustMod.default)
    hljs.registerLanguage('java', javaMod.default)
    hljs.registerLanguage('kotlin', javaMod.default)
    hljs.registerLanguage('css', cssMod.default)
    hljs.registerLanguage('scss', scssMod.default)
    hljs.registerLanguage('sql', sqlMod.default)
    hljs.registerLanguage('bash', bashMod.default)
    hljs.registerLanguage('sh', bashMod.default)
    hljs.registerLanguage('shell', bashMod.default)
    hljs.registerLanguage('json', jsonMod.default)
    hljs.registerLanguage('yaml', yamlMod.default)
    hljs.registerLanguage('yml', yamlMod.default)
    hljs.registerLanguage('html', xmlMod.default)
    hljs.registerLanguage('xml', xmlMod.default)
    hljs.registerLanguage('vue', xmlMod.default)
    hljs.registerLanguage('markdown', mdMod.default)
    hljs.registerLanguage('md', mdMod.default)
    hljs.registerLanguage('diff', diffMod.default)
    _hljs = hljs
  } catch {
    // highlight.js not available, code blocks will render without highlighting
  }
  _hljsReady = true
  return _hljs
}

let markdownInstance: Marked | null = null
let dompurifyInstance: typeof DOMPurify | null = null

const PURIFY_CONFIG: Config = {
  ALLOWED_TAGS: MARKDOWN_ALLOWED_TAGS,
  ALLOWED_ATTR: MARKDOWN_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false
}

const initMarkdown = async (): Promise<void> => {
  if (!markdownInstance || !dompurifyInstance) {
    const [markedMod, dompurifyMod] = await Promise.all([
      import('marked'),
      import('dompurify')
    ])
    markdownInstance = new markedMod.Marked({
      gfm: true,
      breaks: true
    })
    markdownInstance.use({
      renderer: {
        image ({ href, title, text }: { href: string; title: string | null; text: string }) {
          return renderMarkdownImage(href, title, text, { lazy: true })
        }
      }
    })
    dompurifyInstance = dompurifyMod.default || (dompurifyMod as any)
  }
}

export const marked = async (text: string): Promise<string> => {
  try {
    await initMarkdown()
    const html = markdownInstance!.parse(text) as string
    return dompurifyInstance!.sanitize(html, PURIFY_CONFIG)
  } catch (e) {
    return escapeHtml(text)
  }
}

export const renderMarkdown = async (text: string): Promise<string> => {
  try {
    await initMarkdown()
    const hljs = await getHljs()
    markdownInstance!.use({
      renderer: {
        code ({ text: code, lang }: { text: string; lang?: string }) {
          if (!hljs) return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
          const language = lang?.toLowerCase() || ''
          if (language && hljs.getLanguage(language)) {
            try {
              const highlighted = hljs.highlight(code, { language }).value
              return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
            } catch {
              // fall through to auto-detect
            }
          }
          // Try auto-detect for short code blocks
          if (!language && code.length < 2000) {
            try {
              const result = hljs.highlightAuto(code)
              if (result.relevance > 5) {
                return `<pre><code class="hljs language-${result.language}">${result.value}</code></pre>`
              }
            } catch { /* ignore */ }
          }
          return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
        }
      }
    })
    const result = markdownInstance!.parse(text) as string
    return dompurifyInstance!.sanitize(result, PURIFY_CONFIG)
  } catch (e) {
    return escapeHtml(text)
  }
}

export default marked
