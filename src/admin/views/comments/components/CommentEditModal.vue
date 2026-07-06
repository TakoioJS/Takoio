<template>
  <n-modal
    v-model:show="localVisible"
    preset="card"
    title="编辑评论"
    style="max-width: 520px;"
  >
    <n-form
      label-placement="left"
      label-width="60"
    >
      <n-form-item label="昵称">
        <n-input v-model:value="form.nick" />
      </n-form-item>
      <n-form-item label="邮箱">
        <n-input v-model:value="form.mail" />
      </n-form-item>
      <n-form-item label="链接">
        <n-input v-model:value="form.link" />
      </n-form-item>
      <n-form-item label="内容">
        <n-input
          v-model:value="form.comment"
          type="textarea"
          :rows="6"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <n-button
          size="small"
          @click="localVisible = false"
        >
          取消
        </n-button>
        <n-button
          size="small"
          type="primary"
          :loading="saving"
          @click="$emit('save', { ...form })"
        >
          保存
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'
import type { Comment } from '@shared/types'

const props = defineProps<{
  visible: boolean
  comment: Comment | null
  saving: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [form: { id: string; nick: string; mail: string; link: string; comment: string }]
}>()

const localVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const form = reactive({
  id: '', nick: '', mail: '', link: '', comment: '',
})

watch(() => props.comment, (comment) => {
  if (comment) {
    form.id = comment.id
    form.nick = comment.nick
    form.mail = comment.mail || ''
    form.link = comment.link || ''
    form.comment = comment.comment || ''
  }
}, { immediate: true })
</script>
