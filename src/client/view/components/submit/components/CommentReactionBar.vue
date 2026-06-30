<template>
  <div
    v-if="enabled"
    class="tk-comment-reaction-bar"
  >
    <button
      v-for="emoji in visibleEmojis"
      :key="emoji"
      type="button"
      :class="['tk-cr-pill', { 'tk-cr-active': myReaction === emoji }]"
      :aria-pressed="myReaction === emoji"
      @click="onPillClick(emoji)"
    >
      <span class="tk-cr-emoji">{{ emoji }}</span>
      <span class="tk-cr-count">{{ reactions[emoji] }}</span>
    </button>

    <div
      ref="wrapRef"
      class="tk-cr-add-wrap"
    >
      <button
        type="button"
        class="tk-cr-add"
        :aria-label="t('addReaction')"
        :title="t('addReaction')"
        @click="togglePopover"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><circle
          cx="12"
          cy="12"
          r="10"
        /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line
          x1="9"
          y1="9"
          x2="9.01"
          y2="9"
        /><line
          x1="15"
          y1="9"
          x2="15.01"
          y2="9"
        /></svg>
      </button>
      <div
        v-show="showPopover"
        class="tk-cr-popover"
        @click.stop
      >
        <button
          v-for="emoji in emojis"
          :key="emoji"
          type="button"
          :class="['tk-cr-popover-item', { 'tk-cr-active': myReaction === emoji }]"
          :aria-pressed="myReaction === emoji"
          @click="onPopoverPick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { t, toast } from '../../../../utils'
import { useCommentReactions } from '../composables/useCommentReactions'

interface Props {
  commentId: string
  emojis?: string[]
  enabled?: boolean
  envId: string
}
const props = withDefaults(defineProps<Props>(), {
  emojis: () => ['👍', '👎', '🤡', '🧡', '🔥', '👀', '🤣', '🤔'],
  enabled: true,
})

const { reactions, myReaction, fetchReactions, toggleReaction } = useCommentReactions({ envId: props.envId, toast })

const visibleEmojis = computed(() => props.emojis.filter(e => reactions.value[e] > 0))

const showPopover = ref(false)
const wrapRef = ref<HTMLElement>()

const togglePopover = (): void => {
  showPopover.value = !showPopover.value
}

const onPillClick = (emoji: string): void => {
  toggleReaction(props.commentId, emoji)
}

const onPopoverPick = (emoji: string): void => {
  toggleReaction(props.commentId, emoji)
  showPopover.value = false
}

const onDocClick = (e: MouseEvent): void => {
  if (wrapRef.value && !wrapRef.value.contains(e.target as HTMLElement)) {
    showPopover.value = false
  }
}

watch(() => props.commentId, (id) => { if (id) fetchReactions(id) })

onMounted(() => {
  if (props.commentId) fetchReactions(props.commentId)
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.tk-comment-reaction-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.tk-cr-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 13px; line-height: 1.5; border: 1px solid var(--tk-border); border-radius: var(--tk-r-pill); background: var(--tk-bg-muted); color: inherit; cursor: pointer; font-family: inherit; transition: all .15s; }
.tk-cr-pill:hover { border-color: var(--tk-border-strong); }
.tk-cr-pill.tk-cr-active { background: var(--tk-brand-light); border-color: var(--tk-brand); color: var(--tk-brand); }
.tk-cr-emoji { font-size: 14px; line-height: 1; }
.tk-cr-count { font-size: 12px; opacity: .85; }

.tk-cr-add-wrap { position: relative; display: inline-flex; }
.tk-cr-add { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-pill); background: transparent; color: inherit; opacity: .55; cursor: pointer; font-family: inherit; font-size: 13px; transition: all .15s; }
.tk-cr-add:hover { opacity: 1; border-color: var(--tk-border); background: var(--tk-bg-muted); }

.tk-cr-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 100; display: flex; flex-wrap: nowrap; gap: 2px; padding: 6px 8px; background: var(--tk-bg-popup); border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-pill); box-shadow: var(--tk-shadow-lift); }
.tk-cr-popover-item { display: inline-flex; align-items: center; justify-content: center; width: auto; min-width: 30px; height: 30px; padding: 0 6px; border: none; border-radius: var(--tk-r-input); background: transparent; font-size: 18px; cursor: pointer; transition: all .15s; color: inherit; font-family: inherit; }
.tk-cr-popover-item:hover { background: var(--tk-brand-light); transform: scale(1.15); }
.tk-cr-popover-item.tk-cr-active { background: var(--tk-brand-light); }
</style>
