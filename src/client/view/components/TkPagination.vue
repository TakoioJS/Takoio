<template>
  <div class="tk-pagination" v-if="total > pageSize">
    <button class="tk-page-btn" :disabled="current === 1" @click="go(current - 1)">‹</button>
    <button v-for="p in pages" :key="p" :class="['tk-page-btn', { active: p === current }]" @click="go(p)">{{ p }}</button>
    <button class="tk-page-btn" :disabled="current === last" @click="go(current + 1)">›</button>
    <span class="tk-page-jump">
      <input class="tk-page-input" type="number" :min="1" :max="last" :value="current" @change="onJump" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ current: number; pageSize: number; total: number }>()
const emit = defineEmits<{ (e: 'change', page: number): void }>()

const last = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pages = computed(() => {
  const p: number[] = []
  const l = last.value; const c = props.current
  let s = Math.max(1, c - 2); let e = Math.min(l, c + 2)
  if (e - s < 4) { s = Math.max(1, e - 4); e = Math.min(l, s + 4) }
  for (let i = s; i <= e; i++) p.push(i)
  return p
})

const go = (page: number) => { if (page >= 1 && page <= last.value) emit('change', page) }
const onJump = (e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) go(v) }
</script>

<style scoped>
.tk-pagination { display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 20px; flex-wrap: wrap; }
.tk-page-btn {
  min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid rgba(128,128,128,0.2);
  border-radius: 6px; background: transparent; color: inherit; font-size: 13px;
  cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center;
}
.tk-page-btn:hover:not(:disabled):not(.active) { border-color: var(--tk-brand); color: var(--tk-brand); }
.tk-page-btn.active { background: var(--tk-brand); color: #fff; border-color: var(--tk-brand); font-weight: 600; }
.tk-page-btn:disabled { opacity: .35; cursor: default; }
.tk-page-jump { margin-left: 8px; display: flex; align-items: center; }
.tk-page-input { width: 52px; height: 32px; padding: 0 6px; border: 1px solid rgba(128,128,128,0.2);
  border-radius: 6px; background: transparent; color: inherit; font-size: 13px; text-align: center; }
.tk-page-input:focus { outline: none; border-color: var(--tk-brand); }
</style>