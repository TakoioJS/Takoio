<template>
  <div
    v-show="show"
    ref="rootRef"
    class="tk-emotions"
    @click.stop
  >
    <div class="tk-emotion-search-container">
      <input
        v-model="query"
        class="tk-emotion-search-input"
        :placeholder="searchPlaceholder"
        @input="onSearch"
      >
    </div>
    <div
      ref="scrollRef"
      class="tk-emotion-viewport"
      @scroll="onScroll"
    >
      <div
        v-for="(list, name) in visibleGroups"
        :key="name"
        :ref="el => { if (el) groupRefs[name] = el as HTMLElement }"
        class="tk-emotion-group"
      >
        <div class="tk-emotion-group-header">
          {{ name }}
        </div>
        <div class="tk-emotion-grid">
          <span
            v-for="(em, idx) in list"
            :key="idx"
            class="tk-emotion"
            :title="em.text"
            @click="$emit('select', em)"
          >
            <img
              v-if="em.type === 'image'"
              :src="em.icon"
              :alt="em.text"
              class="tk-emotion-img"
            >
            <template v-else>{{ em.icon }}</template>
          </span>
        </div>
      </div>
      <div
        v-if="Object.keys(visibleGroups).length === 0"
        class="tk-emotion-empty"
      >
        {{ emptyText }}
      </div>
    </div>
    <div
      class="tk-emotion-tabs"
      role="tablist"
    >
      <button
        v-for="(_, name) in query.trim() ? visibleGroups : allGroups"
        :key="name"
        type="button"
        :class="['tk-emotion-tab', { active: activeGroup === name }]"
        role="tab"
        :aria-selected="activeGroup === name"
        @click="scrollTo(name)"
      >
        {{ name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { EmotionItem } from '../../../../utils/emotion'

interface Props {
  groups: Record<string, EmotionItem[]>
  show?: boolean
  searchPlaceholder?: string
  emptyText?: string
}
const props = withDefaults(defineProps<Props>(), {
  show: false,
  searchPlaceholder: 'Search...',
  emptyText: 'Not found',
})

const emit = defineEmits<{
  (e: 'select', em: { text: string; icon: string; type?: 'text' | 'image' }): void
}>()

const query = ref('')
const activeGroup = ref('')
const scrollRef = ref<HTMLElement>()
const rootRef = ref<HTMLElement>()
const groupRefs: Record<string, HTMLElement> = {}

const visibleGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.groups
  const result: Record<string, EmotionItem[]> = {}
  for (const [groupName, list] of Object.entries(props.groups)) {
    const matched = list.filter((em) => em.text.toLowerCase().includes(q) || em.icon.toLowerCase().includes(q))
    if (matched.length > 0) result[groupName] = matched
  }
  return result
})

const allGroups = computed(() => props.groups)

const onSearch = (): void => {
  if (!query.value.trim()) { activeGroup.value = Object.keys(props.groups)[0] || ''; return }
  const vg = visibleGroups.value
  if (!vg[activeGroup.value]) activeGroup.value = Object.keys(vg)[0] || ''
}

const scrollTo = (name: string): void => {
  activeGroup.value = name
  const el = groupRefs[name]
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

const onScroll = (): void => {
  if (query.value.trim()) return
  const viewport = scrollRef.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  let current = activeGroup.value
  let minDiff = Infinity
  for (const [name, el] of Object.entries(groupRefs)) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    const diff = Math.abs(r.top - rect.top)
    if (diff < minDiff) { minDiff = diff; current = name }
  }
  activeGroup.value = current
}

const close = (e: MouseEvent): void => {
  if (rootRef.value && !rootRef.value.contains(e.target as HTMLElement)) {
    query.value = ''
    document.removeEventListener('click', close)
  }
}

watch(() => props.show, (v) => {
  if (v) {
    setTimeout(() => document.addEventListener('click', close), 0)
  } else {
    document.removeEventListener('click', close)
    query.value = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', close)
})
</script>

<style scoped>
.tk-emotions {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  margin-top: 8px;
  width: 320px;
  max-width: calc(100vw - 40px);
  background: var(--tk-bg-popup);
  border: 1px solid var(--tk-border-soft);
  border-radius: var(--tk-r-card);
  overflow: hidden;
  box-shadow: var(--tk-shadow-lift);
  display: flex;
  flex-direction: column;
  transition: all .25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tk-emotions .tk-emotion-search-input { color: var(--tk-text); }
.tk-emotions .tk-emotion-group-header { color: var(--tk-text-3) !important; }
.tk-emotions .tk-emotion-empty { color: var(--tk-text-3); }
.tk-emotions .tk-emotion-tab { color: var(--tk-text-3); }
.tk-emotions .tk-emotion-tab:hover { color: var(--tk-text); }
.tk-emotion-search-container { padding: 8px 12px; border-bottom: 1px solid var(--tk-border-soft); }
.tk-emotion-search-input {
  width: 100%; height: 32px; padding: 0 10px; font-size: 13px;
  color: var(--tk-text); background: var(--tk-bg-muted);
  border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-input);
  outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.tk-emotion-search-input:focus { border-color: var(--tk-brand); box-shadow: 0 0 0 2px var(--tk-brand-ring); }
.tk-emotion-viewport {
  max-height: 220px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column;
}
.tk-emotion-viewport::-webkit-scrollbar { width: 6px; }
.tk-emotion-viewport::-webkit-scrollbar-thumb { background: var(--tk-border); border-radius: 3px; }
.tk-emotion-viewport::-webkit-scrollbar-track { background: transparent; }
.tk-emotion-group-header {
  position: sticky; top: 0; z-index: 2;
  background: var(--tk-bg-popup); padding: 6px 12px;
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  color: var(--tk-text-3); border-bottom: 1px solid var(--tk-border-soft);
  letter-spacing: 0.5px;
}
.tk-emotion-grid { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 10px; }
.tk-emotion {
  display: flex; align-items: center; justify-content: center;
  min-width: 36px; height: 36px; cursor: pointer; font-size: 16px;
  padding: 0 6px; box-sizing: border-box; border-radius: var(--tk-r-input);
  transition: all .15s cubic-bezier(0.4, 0, 0.2, 1); color: var(--tk-text);
}
.tk-emotion:hover { background: var(--tk-brand-light); transform: scale(1.15); }
.tk-emotion-img { width: 24px; height: 24px; object-fit: contain; }
.tk-emotion-empty { padding: 24px; text-align: center; font-size: 13px; color: var(--tk-text-3); }
.tk-emotion-tabs {
  display: flex; gap: 2px; padding: 6px 8px;
  background: var(--tk-bg-subtle); border-top: 1px solid var(--tk-border-soft);
  overflow-x: auto;
}
.tk-emotion-tabs::-webkit-scrollbar { height: 2px; }
.tk-emotion-tabs::-webkit-scrollbar-thumb { background: var(--tk-border); border-radius: 1px; }
.tk-emotion-tab {
  padding: 4px 10px; border: none; background: transparent;
  color: var(--tk-text-3); cursor: pointer; font-size: 12px;
  border-radius: var(--tk-r-input); white-space: nowrap; transition: all .15s;
  font-family: inherit; font-weight: 600;
}
.tk-emotion-tab:hover { color: var(--tk-text); background: var(--tk-bg-muted); }
.tk-emotion-tab.active { background: var(--tk-brand-light); color: var(--tk-brand); }
</style>
