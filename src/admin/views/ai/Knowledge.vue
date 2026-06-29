<template>
  <div class="knowledge-page">
    <!-- 知识库状态 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><ServerOutline /></n-icon>
        <span class="section-title">知识库状态</span>
      </div>
      <div class="section-body">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ stats.redisAvailable ? '✅' : '❌' }}</span>
            <span class="stat-label">Redis 连接</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.totalDocs }}</span>
            <span class="stat-label">已索引文章</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.totalChunks }}</span>
            <span class="stat-label">文档块</span>
          </div>
        </div>
        <n-button size="small" @click="refreshStatus" :loading="loadingStatus">刷新状态</n-button>
      </div>
    </div>

    <!-- 文章索引 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><CloudUploadOutline /></n-icon>
        <span class="section-title">索引文章</span>
      </div>
      <div class="section-body">
        <div class="form-field">
          <label class="form-label">文章 URL</label>
          <n-input v-model:value="indexForm.url" />
        </div>
        <div class="form-field">
          <label class="form-label">文章标题</label>
          <n-input v-model:value="indexForm.title" />
        </div>
        <div class="form-field">
          <label class="form-label">文章内容</label>
          <n-input v-model:value="indexForm.content" type="textarea" :rows="8" />
        </div>
        <n-button type="primary" :loading="indexing" @click="onIndexArticle">
          <template #icon><n-icon><CloudUploadOutline /></n-icon></template>
          开始索引
        </n-button>
      </div>
    </div>

    <!-- 已索引文章 -->
    <div class="section-card" v-if="stats.indexedUrls.length > 0">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><DocumentsOutline /></n-icon>
        <span class="section-title">已索引文章</span>
      </div>
      <div class="section-body">
        <div v-for="url in stats.indexedUrls" :key="url" class="indexed-item">
          <span class="indexed-url">{{ url }}</span>
          <n-button size="tiny" type="error" quaternary @click="onDeleteIndex(url)">
            <template #icon><n-icon><TrashOutline /></n-icon></template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 对话测试 -->
    <div class="section-card">
      <div class="section-header">
        <n-icon size="18" class="section-icon"><ChatbubblesOutline /></n-icon>
        <span class="section-title">对话测试</span>
      </div>
      <div class="section-body">
        <div class="form-field">
          <label class="form-label">限定文章 URL（可选）</label>
          <n-input v-model:value="chatUrl" />
        </div>
        <div class="chat-panel">
          <div class="chat-messages" ref="chatMessagesRef">
            <div v-if="chatMessages.length === 0" class="chat-empty">
              输入问题测试知识库对话效果
            </div>
            <div v-for="(msg, idx) in chatMessages" :key="idx" :class="['chat-bubble', msg.role]">
              <div class="bubble-content">{{ msg.content }}</div>
              <div v-if="msg.sources?.length" class="bubble-sources">
                来源：{{ msg.sources.join('、') }}
              </div>
            </div>
          </div>
          <div class="chat-input-row">
            <n-input
              v-model:value="chatInput"
              placeholder="输入问题..."
              @keyup.enter="onChat"
              :disabled="chatting"
            />
            <n-button type="primary" :loading="chatting" @click="onChat">发送</n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  NInput, NButton, NIcon, NSelect,
  useMessage, useDialog,
} from 'naive-ui'
import {
  ServerOutline, CloudUploadOutline, DocumentsOutline,
  ChatbubblesOutline, TrashOutline,
} from '@vicons/ionicons5'
import { api } from '../../api/client'

const message = useMessage()
const dialog = useDialog()

// Status
const loadingStatus = ref(false)
const stats = reactive({
  redisAvailable: false,
  totalDocs: 0,
  totalChunks: 0,
  indexedUrls: [] as string[],
})

const refreshStatus = async () => {
  loadingStatus.value = true
  try {
    const r = await api.get('/api/ai/knowledge/status')
    stats.redisAvailable = r.redisAvailable
    stats.totalDocs = r.stats.totalDocs
    stats.totalChunks = r.stats.totalChunks
    stats.indexedUrls = r.stats.indexedUrls
  } catch (e: any) {
    message.error('获取状态失败: ' + (e.message || ''))
  } finally {
    loadingStatus.value = false
  }
}

// Index
const indexing = ref(false)
const indexForm = reactive({ url: '', title: '', content: '' })

const onIndexArticle = async () => {
  if (!indexForm.url || !indexForm.content) {
    message.warning('请填写文章 URL 和内容')
    return
  }
  indexing.value = true
  try {
    const r = await api.post('/api/ai/knowledge/index', { ...indexForm })
    if (r.success) {
      message.success(r.message)
      indexForm.content = ''
      await refreshStatus()
    } else {
      message.error(r.message)
    }
  } catch (e: any) {
    message.error('索引失败: ' + (e.message || ''))
  } finally {
    indexing.value = false
  }
}

// Delete
const onDeleteIndex = (url: string) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除 ${url} 的索引吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const r = await api.delete(`/api/ai/knowledge/index?url=${encodeURIComponent(url)}`)
        if (r.success) message.success(r.message)
        else message.error(r.message)
        await refreshStatus()
      } catch (e: any) {
        message.error('删除失败')
      }
    },
  })
}

// Chat test
const chatUrl = ref('')
const chatInput = ref('')
const chatting = ref(false)
const chatMessagesRef = ref<HTMLElement | null>(null)
const chatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string; sources?: string[] }>>([])

const onChat = async () => {
  const q = chatInput.value.trim()
  if (!q || chatting.value) return

  chatMessages.value.push({ role: 'user', content: q })
  chatInput.value = ''
  chatting.value = true

  try {
    const r = await api.post('/api/ai/knowledge/chat', {
      question: q,
      url: chatUrl.value || undefined,
    })
    chatMessages.value.push({
      role: 'assistant',
      content: r.answer || r.message,
      sources: r.sources,
    })
  } catch (e: any) {
    chatMessages.value.push({
      role: 'assistant',
      content: '请求失败: ' + (e.message || ''),
    })
  } finally {
    chatting.value = false
    // Scroll to bottom
    setTimeout(() => {
      if (chatMessagesRef.value) {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
      }
    }, 50)
  }
}

onMounted(() => {
  refreshStatus()
})
</script>

<style scoped>
.knowledge-page { max-width: 900px; }

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
.section-body { padding: 18px; }

.form-field { margin-bottom: 16px; }
.form-field:last-child { margin-bottom: 0; }
.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 6px;
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--edge-soft);
  border-radius: 10px;
}
.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 4px;
}
.stat-label {
  font-size: 12px;
  color: var(--ink-3);
}

/* Indexed items */
.indexed-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--edge-soft);
}
.indexed-item:last-child { border-bottom: none; }
.indexed-url {
  font-size: 13px;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Chat panel */
.chat-panel {
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
  overflow: hidden;
}
.chat-messages {
  max-height: 320px;
  overflow-y: auto;
  padding: 14px;
  background: var(--bg-subtle, #f9fafb);
}
.chat-empty {
  text-align: center;
  padding: 24px 0;
  color: var(--ink-3);
  font-size: 13px;
}
.chat-bubble {
  margin-bottom: 10px;
  max-width: 85%;
}
.chat-bubble.user {
  margin-left: auto;
  text-align: right;
}
.chat-bubble.assistant {
  margin-right: auto;
}
.bubble-content {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-bubble.user .bubble-content {
  background: var(--accent);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.chat-bubble.assistant .bubble-content {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-bottom-left-radius: 4px;
  color: var(--ink);
}
.bubble-sources {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 4px;
}
.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--edge-soft);
  background: var(--paper);
}
</style>
