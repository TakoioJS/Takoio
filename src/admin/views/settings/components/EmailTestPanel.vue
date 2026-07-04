<template>
  <div class="field-row full-row email-test-row">
    <div class="field-label-col">
      <div class="field-label">测试发送</div>
      <p class="field-desc">发送一封测试邮件验证 SMTP 配置</p>
    </div>
    <div class="field-control-col">
      <div class="email-test-controls">
        <n-input
          v-model:value="recipient"
          placeholder="收件人邮箱（留空用默认）"
          size="small"
          style="flex:1"
        />
        <n-select
          v-model:value="template"
          :options="templateOptions"
          size="small"
          style="width:120px"
        />
        <n-button
          type="primary"
          size="small"
          :loading="testing"
          @click="onSend"
        >
          <template #icon>
            <n-icon size="14"><MailOutline /></n-icon>
          </template>
          发送
        </n-button>
      </div>
      <div v-if="log" class="email-test-log">
        <pre>{{ log }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NSelect, NButton, NIcon, useMessage } from 'naive-ui'
import { MailOutline } from '@vicons/ionicons5'
import { configApi } from '../../../api/config'
import { t } from '@shared/utils/i18n'

const message = useMessage()
const recipient = ref('')
const template = ref<'user' | 'admin'>('user')
const testing = ref(false)
const log = ref('')

const templateOptions = [
  { label: '用户邮件', value: 'user' },
  { label: '管理员邮件', value: 'admin' },
]

const onSend = async () => {
  testing.value = true
  log.value = ''
  try {
    const result: any = await configApi.testEmail(recipient.value, template.value)
    if (result.log && Array.isArray(result.log)) {
      log.value = result.log.map((entry: any) =>
        `[${new Date(entry.time).toLocaleTimeString()}] ${entry.level.toUpperCase()}: ${entry.message}`
      ).join('\n')
    }
    if (result.success) {
      message.success(result.message)
    } else {
      message.error(result.message)
    }
  } catch (e: any) {
    log.value = `错误: ${e.message || t('requestFailed')}`
    message.error(t('emailTestFailed'))
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.email-test-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.email-test-log {
  margin-top: 10px;
  background: var(--edge-soft);
  border-radius: var(--r-card, 8px);
  padding: 10px 14px;
  max-height: 200px;
  overflow-y: auto;
}
.email-test-log pre {
  margin: 0;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ink-2);
}
</style>