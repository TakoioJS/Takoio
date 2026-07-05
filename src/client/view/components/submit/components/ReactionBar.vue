<template>
  <div class="tk-reaction-list">
    <button
      v-for="emoji in emojis"
      :key="emoji"
      type="button"
      :class="['tk-reaction-btn', { active: myReactions.includes(emoji) }]"
      @click="$emit('toggle', emoji)"
    >
      {{ emoji }} <span
        v-if="reactions[emoji]"
        class="tk-reaction-count"
      >{{ reactions[emoji] }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  emojis: string[]
  reactions: Record<string, number>
  myReactions: string[]
}
defineProps<Props>()
defineEmits<{ (e: 'toggle', emoji: string): void }>()
</script>

<style scoped>
.tk-reaction-list { display: flex; gap: 8px; flex-wrap: wrap; }
.tk-reaction-btn { background: var(--tk-bg-muted); border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-pill); padding: 2px 8px; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; color: inherit; font-family: inherit; }
.tk-reaction-btn:hover { background: var(--tk-bg-muted); border-color: var(--tk-border); }
.tk-reaction-btn.active { background: var(--tk-brand-light); border-color: var(--tk-brand); color: var(--tk-brand); border-radius: var(--tk-r-pill); }
.tk-reaction-count { font-size: 12px; opacity: 0.8; }
</style>
