<template>
  <div class="tk-markdown-actions">
    <button
      v-for="btn in buttons"
      :key="btn.action"
      type="button"
      class="tk-btn-circle"
      :data-tip="btn.tooltip"
      :aria-label="btn.tooltip"
      @click="btn.handler"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        v-html="btn.icon"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  editorRef: { value: HTMLTextAreaElement | null | undefined }
  modelValue: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

const wrapSelection = (prefix: string, suffix: string): void => {
  const ta = props.editorRef.value
  if (!ta) return
  ta.focus()
  const s = ta.selectionStart
  const e = ta.selectionEnd
  const sel = ta.value.substring(s, e)
  const textToInsert = prefix + sel + suffix
  let inserted = false
  try { inserted = document.execCommand('insertText', false, textToInsert) } catch {}
  if (!inserted) {
    emit('update:modelValue', props.modelValue.substring(0, s) + textToInsert + props.modelValue.substring(e))
    setTimeout(() => { ta.setSelectionRange(s + prefix.length, s + prefix.length + sel.length) }, 0)
  } else {
    if (sel.length === 0) {
      const p = s + prefix.length
      ta.setSelectionRange(p, p)
    } else {
      ta.setSelectionRange(s + prefix.length, s + prefix.length + sel.length)
    }
  }
}

const buttons = [
  {
    action: 'bold', tooltip: 'Bold',
    icon: '<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>',
    handler: () => wrapSelection('**', '**'),
  },
  {
    action: 'italic', tooltip: 'Italic',
    icon: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
    handler: () => wrapSelection('*', '*'),
  },
  {
    action: 'strike', tooltip: 'Strikethrough',
    icon: '<path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8"/><path d="M8 20h7a3 3 0 0 0 0-6H5"/>',
    handler: () => wrapSelection('~~', '~~'),
  },
  {
    action: 'link', tooltip: 'Link',
    icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    handler: () => wrapSelection('[', '](url)'),
  },
  {
    action: 'code', tooltip: 'Inline code',
    icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    handler: () => wrapSelection('`', '`'),
  },
  {
    action: 'codeblock', tooltip: 'Code block',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    handler: () => wrapSelection('\n```\n', '\n```\n'),
  },
  {
    action: 'quote', tooltip: 'Quote',
    icon: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/>',
    handler: () => wrapSelection('\n> ', ''),
  },
]
</script>

<style scoped>
.tk-markdown-actions { display: flex; gap: 4px; align-items: center; overflow-x: auto; white-space: nowrap; scrollbar-width: none; -webkit-overflow-scrolling: touch; flex: 1; }
.tk-markdown-actions::-webkit-scrollbar { display: none; }
.tk-btn-circle { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: inherit; opacity: .6; cursor: pointer; border-radius: 50%; transition: all .15s; padding: 0; flex-shrink: 0; }
.tk-btn-circle:hover { opacity: 1; background: var(--tk-bg-muted); }
</style>
