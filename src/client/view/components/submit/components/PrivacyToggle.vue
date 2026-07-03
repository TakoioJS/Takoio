<template>
  <button
    type="button"
    class="tk-privacy-toggle"
    :class="{ 'tk-privacy-toggle-on': modelValue }"
    :aria-pressed="modelValue"
    :aria-label="modelValue ? privateLabel : publicLabel"
    :title="modelValue ? privateLabel : publicLabel"
    @click="toggle"
  >
    <span class="tk-privacy-icon">
      <!-- 公开：eye -->
      <svg
        v-if="!modelValue"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
        cx="12"
        cy="12"
        r="3"
      /></svg>
      <!-- 私密：lock -->
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><rect
        x="3"
        y="11"
        width="18"
        height="11"
        rx="2"
        ry="2"
      /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    </span>
    <span class="tk-privacy-track">
      <span class="tk-privacy-thumb" />
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  publicLabel?: string
  privateLabel?: string
}
const props = withDefaults(defineProps<Props>(), {
  publicLabel: '公开',
  privateLabel: '私密',
})
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'update:private', val: boolean): void
}>()

const toggle = () => {
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('update:private', next)
}
</script>

<style scoped>
.tk-privacy-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 6px;
  background: transparent; border: none; border-radius: var(--tk-r-pill);
  color: var(--tk-text-tertiary);
  cursor: pointer; font-family: inherit; font-size: 11px;
  transition: all .15s;
  flex-shrink: 0;
}
.tk-privacy-toggle:hover { background: var(--tk-bg-hover); color: var(--tk-text-primary); }
.tk-privacy-icon { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; }
.tk-privacy-track {
  display: inline-block; position: relative;
  width: 28px; height: 16px;
  background: var(--tk-bg-hover);
  border-radius: var(--tk-r-pill);
  transition: background .18s ease;
}
.tk-privacy-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px;
  background: var(--tk-text-secondary);
  border-radius: 50%;
  transition: left .18s ease, background .18s ease;
}
.tk-privacy-toggle-on .tk-privacy-track { background: var(--tk-brand); }
.tk-privacy-toggle-on .tk-privacy-thumb { left: 14px; background: #fff; }
.tk-privacy-toggle-on { color: var(--tk-brand); }
</style>
