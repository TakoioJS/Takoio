<template>
  <n-modal
    v-model:show="localVisible"
    preset="card"
    title="回复评论"
    style="max-width: 520px;"
  >
    <div v-if="comment" class="reply-quote">
      <div class="quote-meta">
        <span class="quote-name">{{ comment.nick }}</span>
        <span class="quote-time">{{ formatTime(comment.created) }}</span>
      </div>
      <div class="quote-content" v-html="comment._safeContent || ''" />
    </div>
    <n-form label-placement="left" label-width="60">
      <n-form-item label="昵称">
        <n-input v-model:value="form.nick" placeholder="博主" />
      </n-form-item>
      <n-form-item label="邮箱">
        <n-input v-model:value="form.mail" placeholder="博主邮箱（选填）" />
      </n-form-item>
      <n-form-item label="回复">
        <n-input v-model:value="form.comment" type="textarea" :rows="5" placeholder="输入回复内容..." />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <n-button size="small" @click="localVisible = false">取消</n-button>
        <n-button size="small" type="primary" :loading="loading" :disabled="!form.comment.trim() || !form.nick.trim()" @click="$emit('send', { ...form })">发送回复</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'
import type { Comment } from '@shared/types'

const props = defineProps<{
  visible: boolean
  comment: Comment | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  send: [form: { nick: string; mail: string; comment: string }]
}>()

const form = reactive({
  nick: '', mail: '', comment: '',
})

const localVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.reply-quote {
  background: var(--edge-soft);
  border-left: 3px solid var(--accent);
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}
.quote-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.quote-name { font-size: 12px; font-weight: 600; color: var(--ink); }
.quote-time { font-size: 11px; color: var(--ink-3); }
.quote-content {
  font-size: 12px; color: var(--ink-2); line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
}
</style>