<template>
  <div class="summary-page">
    <!-- Redis 状态 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><ServerOutline /></n-icon>
        <span class="section-title">Redis 状态</span>
      </div>
      <div class="section-body">
        <div class="redis-status-row">
          <n-tag :type="redisAvailable ? 'success' : 'error'" size="small" round>
            {{ redisAvailable ? '✅ 已连接' : '❌ 未连接' }}
          </n-tag>
          <span v-if="!redisAvailable" class="redis-hint">
            请设置环境变量 REDIS_URL（摘要功能需要 Redis）
          </span>
        </div>
      </div>
    </div>

    <!-- 摘要测试 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><DocumentTextOutline /></n-icon>
        <span class="section-title">摘要测试</span>
      </div>
      <div class="section-body">
        <div class="form-field">
          <label class="form-label">文章标题（可选）</label>
          <n-input v-model:value="testForm.title" placeholder="文章标题" />
        </div>
        <div class="form-field">
          <label class="form-label">文章内容</label>
          <n-input v-model:value="testForm.content" type="textarea" :rows="8" placeholder="粘贴文章内容测试摘要生成" />
        </div>
        <n-button type="primary" :loading="testing" :disabled="!testForm.content.trim()" @click="onTestGenerate">
          <template #icon><n-icon><FlashOutline /></n-icon></template>
          生成摘要
        </n-button>

        <!-- 测试结果 -->
        <div v-if="testResult" class="test-result" :class="{ error: !testResult.success }">
          <div v-if="testResult.success" class="test-result-content">
            <div class="test-result-summary">{{ testResult.summary }}</div>
            <div v-if="testResult.keywords?.length" class="test-result-keywords">
              <span class="kw-label">关键词：</span>
              <n-tag v-for="kw in testResult.keywords" :key="kw" size="small" round type="success">{{ kw }}</n-tag>
            </div>
          </div>
          <div v-else class="test-result-error">{{ testResult.message }}</div>
        </div>
      </div>
    </div>

    <!-- 已生成摘要列表 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><ListOutline /></n-icon>
        <span class="section-title">已生成摘要（{{ summaries.length }}）</span>
        <div class="section-actions">
          <n-button size="small" quaternary @click="loadSummaries" :loading="loadingList">刷新</n-button>
          <n-button v-if="summaries.length > 0" size="small" type="error" quaternary @click="onClearAll">清空全部</n-button>
        </div>
      </div>
      <div class="section-body">
        <div v-if="summaries.length === 0" class="empty-hint">
          暂无已生成的摘要
        </div>
        <div v-else class="summary-list">
          <div v-for="item in summaries" :key="item.key" class="summary-item">
            <div class="summary-item-main">
              <div class="summary-item-url">{{ item.url }}</div>
              <div class="summary-item-title" v-if="item.title">{{ item.title }}</div>
              <div class="summary-item-text">{{ item.summary.slice(0, 80) }}{{ item.summary.length > 80 ? '…' : '' }}</div>
              <div v-if="item.keywords?.length" class="summary-item-keywords">
                <n-tag v-for="kw in item.keywords.slice(0, 5)" :key="kw" size="tiny" round>{{ kw }}</n-tag>
              </div>
              <div class="summary-item-time">{{ formatTime(item.created) }}</div>
            </div>
            <n-button size="tiny" type="error" quaternary @click="onDeleteSummary(item.url)">
              <template #icon><n-icon><TrashOutline /></n-icon></template>
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  NInput, NButton, NIcon, NTag,
  useMessage, useDialog,
} from 'naive-ui'
import {
  ServerOutline, DocumentTextOutline, ListOutline,
  FlashOutline, TrashOutline,
} from '@vicons/ionicons5'
import { api } from '../../api/client'

const message = useMessage()
const dialog = useDialog()

const redisAvailable = ref(false)
const testing = ref(false)
const loadingList = ref(false)
const testResult = ref<any>(null)

const testForm = reactive({
  content: '',
  title: '',
})

interface SummaryItem {
  key: string
  url: string
  title?: string
  summary: string
  keywords: string[]
  created: number
}

const summaries = ref<SummaryItem[]>([])

const formatTime = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadSummaries = async () => {
  loadingList.value = true
  try {
    const r = await api.get('/api/ai/summary/list')
    redisAvailable.value = r.redisAvailable
    summaries.value = r.summaries || []
  } catch (e: any) {
    message.error('加载列表失败: ' + (e.message || ''))
  } finally {
    loadingList.value = false
  }
}

const onTestGenerate = async () => {
  if (!testForm.content.trim()) return
  testing.value = true
  testResult.value = null
  try {
    const r = await api.post('/api/ai/summary/test', {
      content: testForm.content,
      title: testForm.title || undefined,
    })
    testResult.value = r
  } catch (e: any) {
    testResult.value = { success: false, message: e.message || '请求失败' }
  } finally {
    testing.value = false
  }
}

const onDeleteSummary = (url: string) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除该 URL 的摘要缓存吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.delete(`/api/ai/summary?url=${encodeURIComponent(url)}`)
        message.success('删除成功')
        await loadSummaries()
      } catch (e: any) {
        message.error('删除失败: ' + (e.message || ''))
      }
    },
  })
}

const onClearAll = () => {
  dialog.warning({
    title: '确认清空',
    content: `确定要清空所有 ${summaries.value.length} 条摘要缓存吗？此操作不可撤销。`,
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.delete('/api/ai/summary/all')
        message.success('已清空全部摘要缓存')
        await loadSummaries()
      } catch (e: any) {
        message.error('清空失败: ' + (e.message || ''))
      }
    },
  })
}

onMounted(() => {
  loadSummaries()
})
</script>

<style scoped>
.summary-page { max-width: 900px; }

.section-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: var(--shadow-paper);
}
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--edge-soft);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.section-icon { color: var(--accent); }
.section-actions { margin-left: auto; display: flex; gap: 6px; }
.section-body { padding: 18px; }

.form-field { margin-bottom: 16px; }
.form-field:last-child { margin-bottom: 0; }
.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 6px;
}

.redis-status-row { display: flex; align-items: center; gap: 10px; }
.redis-hint { font-size: 12px; color: var(--ink-3); }

.empty-hint {
  text-align: center;
  padding: 32px 0;
  color: var(--ink-3);
  font-size: 14px;
}

/* Test result */
.test-result {
  margin-top: 16px;
  padding: 14px;
  border-radius: 10px;
  background: var(--edge-soft);
}
.test-result.error { background: color-mix(in srgb, var(--danger, #b0524f) 8%, transparent); }
.test-result-summary { font-size: 14px; line-height: 1.7; color: var(--ink); }
.test-result-keywords { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
.kw-label { font-size: 12px; color: var(--ink-3); }
.test-result-error { font-size: 13px; color: var(--danger, #b0524f); }

/* Summary list */
.summary-list { display: flex; flex-direction: column; gap: 10px; }
.summary-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
  background: var(--paper-2, var(--paper));
}
.summary-item-main { flex: 1; min-width: 0; }
.summary-item-url {
  font-size: 12px;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}
.summary-item-title { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.summary-item-text { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
.summary-item-keywords { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.summary-item-time { font-size: 11px; color: var(--ink-3); margin-top: 6px; }
</style>
