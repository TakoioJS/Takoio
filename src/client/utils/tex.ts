import type { TexRenderer } from '../types'

const SKIP_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'SCRIPT', 'STYLE', 'TEXTAREA'])

type TextSegment =
  | { type: 'text', value: string }
  | { type: 'tex', value: string, blockMode: boolean, raw: string }

const isEscaped = (text: string, index: number): boolean => {
  let slashCount = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) slashCount++
  return slashCount % 2 === 1
}

const findDelimiter = (text: string, start: number, delimiter: '$' | '$$'): number => {
  for (let i = start; i < text.length; i++) {
    if (text.startsWith(delimiter, i) && !isEscaped(text, i)) return i
  }
  return -1
}

const parseTexSegments = (text: string): TextSegment[] => {
  const segments: TextSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const open = findDelimiter(text, cursor, '$')
    if (open < 0) break

    const blockMode = text.startsWith('$$', open)
    const delimiter = blockMode ? '$$' : '$'
    const contentStart = open + delimiter.length
    const close = findDelimiter(text, contentStart, delimiter)
    if (close < 0) break

    if (open > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, open) })
    }

    const value = text.slice(contentStart, close)
    const raw = text.slice(open, close + delimiter.length)
    if (value) {
      segments.push({ type: 'tex', value, blockMode, raw })
    } else {
      segments.push({ type: 'text', value: raw })
    }
    cursor = close + delimiter.length
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) })
  }

  return segments.some(segment => segment.type === 'tex') ? segments : [{ type: 'text', value: text }]
}

const shouldSkipTextNode = (node: Node): boolean => {
  let parent = node.parentElement
  while (parent) {
    if (SKIP_TAGS.has(parent.tagName)) return true
    parent = parent.parentElement
  }
  return false
}

const htmlToFragment = (html: string): DocumentFragment => {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

export const renderTex = async (root: HTMLElement, renderer?: TexRenderer): Promise<void> => {
  if (!renderer || typeof document === 'undefined') return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    if (node.textContent?.includes('$') && !shouldSkipTextNode(node)) {
      textNodes.push(node as Text)
    }
    node = walker.nextNode()
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent || ''
    const segments = parseTexSegments(original)
    if (!segments.some(segment => segment.type === 'tex')) continue

    const fragment = document.createDocumentFragment()
    for (const segment of segments) {
      if (segment.type === 'text') {
        fragment.appendChild(document.createTextNode(segment.value))
        continue
      }
      try {
        fragment.appendChild(htmlToFragment(await renderer(segment.blockMode, segment.value)))
      } catch {
        fragment.appendChild(document.createTextNode(segment.raw))
      }
    }
    textNode.replaceWith(fragment)
  }
}
