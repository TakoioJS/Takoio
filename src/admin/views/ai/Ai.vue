<template>
  <div class="ai-page">
    <n-spin :show="loading">
      <!-- AI 提供商 -->
      <div class="section-card">
        <div class="section-header">
          <n-icon
            size="18"
            class="section-icon"
          >
            <CubeOutline />
          </n-icon>
          <span class="section-title">AI 提供商</span>
        </div>
        <div class="section-body">
          <div
            v-if="aiProviders.length === 0"
            class="empty-hint"
          >
            暂无 AI 提供商，点击下方按钮添加
          </div>
          <div
            v-for="(provider, idx) in aiProviders"
            :key="idx"
            class="ai-provider-card"
          >
            <div class="ai-provider-header">
              <n-input
                v-model:value="provider.name"
                placeholder="提供商名称"
                class="provider-name-input"
              />
              <n-tag
                :type="provider.format === 'openai' ? 'success' : provider.format === 'anthropic' ? 'warning' : 'info'"
                size="small"
                round
              >
                {{ provider.format }}
              </n-tag>
              <n-button
                quaternary
                size="small"
                type="error"
                @click="removeProvider(idx)"
              >
                <template #icon>
                  <n-icon><TrashOutline /></n-icon>
                </template>
              </n-button>
            </div>
            <div class="ai-provider-body">
              <div class="form-field">
                <label class="form-label">接口格式</label>
                <n-select
                  v-model:value="provider.format"
                  :options="aiFormatOptions"
                />
              </div>
              <div class="form-field">
                <label class="form-label">API 地址</label>
                <n-input
                  v-model:value="provider.endpoint"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div class="form-field">
                <label class="form-label">API Key</label>
                <n-input
                  v-model:value="provider.key"
                  type="password"
                  show-password-on="click"
                  placeholder="sk-..."
                />
              </div>
              <div class="form-field">
                <label class="form-label">模型列表</label>
                <div class="models-row">
                  <n-select
                    v-model:value="provider.models"
                    :options="provider.modelOptions || []"
                    multiple
                    filterable
                    tag
                    class="models-select"
                    placeholder="选择或输入模型名称"
                  />
                  <n-button
                    size="small"
                    :loading="provider.fetching"
                    :disabled="!provider.endpoint || !provider.key"
                    @click="onFetchModels(idx)"
                  >
                    <template #icon>
                      <n-icon><DownloadOutline /></n-icon>
                    </template>
                    拉取
                  </n-button>
                </div>
              </div>
            </div>
          </div>
          <n-button
            dashed
            block
            @click="addProvider"
          >
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            添加提供商
          </n-button>
        </div>
      </div>

      <!-- 文章摘要 -->
      <div class="section-card">
        <div class="section-header">
          <n-icon
            size="18"
            class="section-icon"
          >
            <DocumentTextOutline />
          </n-icon>
          <span class="section-title">文章摘要</span>
        </div>
        <div class="section-body">
          <div class="form-field switch-field">
            <label class="form-label">启用文章摘要生成</label>
            <n-switch v-model:value="config.AI_SUMMARY_ENABLED" />
          </div>
          <div class="form-field switch-field">
            <label class="form-label">在评论区显示摘要</label>
            <n-switch v-model:value="config.ENABLE_SUMMARY" />
          </div>
          <div class="form-hint">
            关闭后前端评论区不展示摘要卡片（宿主仍可通过 API 自行渲染）
          </div>
          <template v-if="config.AI_SUMMARY_ENABLED">
            <div class="form-field">
              <label class="form-label">摘要提供商</label>
              <n-select
                v-model:value="config.AI_SUMMARY_PROVIDER"
                :options="aiProviderNameOptions"
                clearable
              />
            </div>
            <div class="form-field">
              <label class="form-label">摘要模型</label>
              <n-select
                v-model:value="config.AI_SUMMARY_MODEL"
                :options="summaryModelOptions"
                filterable
                tag
                clearable
              />
            </div>
          </template>
        </div>
      </div>

      <!-- NSFW 检测 -->
      <div class="section-card">
        <div class="section-header">
          <n-icon
            size="18"
            class="section-icon"
          >
            <EyeOffOutline />
          </n-icon>
          <span class="section-title">NSFW 检测</span>
        </div>
        <div class="section-body">
          <div class="form-field switch-field">
            <label class="form-label">启用 NSFW 检测</label>
            <n-switch v-model:value="config.ENABLE_NSFW_DETECTION" />
          </div>

          <template v-if="config.ENABLE_NSFW_DETECTION">
            <div class="form-field">
              <label class="form-label">检测服务</label>
              <n-select
                v-model:value="config.NSFW_SERVICE"
                :options="nsfwServiceOptions"
              />
            </div>
            <div
              v-if="config.NSFW_SERVICE === 'self'"
              class="form-field"
            >
              <label class="form-label">检测服务地址</label>
              <n-input
                v-model:value="config.NSFW_ENDPOINT"
                placeholder="http://localhost:8080"
              />
            </div>
            <div
              v-if="config.NSFW_SERVICE === 'modelark'"
              class="form-field"
            >
              <label class="form-label">API Key</label>
              <SensitiveInput
                v-model="config.NSFW_API_KEY"
                :has-value="!!savedConfig?.NSFW_API_KEY"
                placeholder="ModelArk API Key"
              />
            </div>
            <div class="form-field">
              <label class="form-label">阈值</label>
              <div class="slider-row">
                <n-slider
                  v-model:value="config.NSFW_THRESHOLD"
                  :min="0"
                  :max="1"
                  :step="0.05"
                />
                <span class="slider-value">{{ config.NSFW_THRESHOLD }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </n-spin>

    <div
      v-if="isDirty"
      class="save-bar"
    >
      <n-button @click="onReset">
        重置
      </n-button>
      <n-button
        type="primary"
        :loading="saving"
        @click="onSave"
      >
        保存更改
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  NInput, NSelect, NSwitch, NButton, NTag, NSpin, NIcon, NSlider,
  useMessage, useDialog,
} from 'naive-ui'
import {
  CubeOutline, EyeOffOutline, DocumentTextOutline,
  AddOutline, TrashOutline, DownloadOutline,
} from '@vicons/ionicons5'
import { configApi } from '../../api/config'
import SensitiveInput from '../../components/SensitiveInput.vue'

interface AiProvider {
  name: string
  format: 'openai' | 'anthropic' | 'gemini'
  endpoint: string
  key: string
  models: string[]
  modelOptions: { label: string; value: string }[]
  fetching: boolean
}

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const saving = ref(false)
const config = reactive<Record<string, any>>({})
const savedConfig = ref<Record<string, any> | null>(null)

const aiFormatOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Gemini', value: 'gemini' },
]

const nsfwServiceOptions = [
  { label: 'Nsfw-Py', value: 'self' },
  { label: 'ModelArk', value: 'modelark' },
]

const aiProviders = reactive<AiProvider[]>([])

const aiProviderNameOptions = computed(() =>
  aiProviders.map(p => ({ label: p.name || p.format, value: p.name }))
)

const addProvider = () => {
  aiProviders.push({
    name: '', format: 'openai', endpoint: '', key: '', models: [], modelOptions: [], fetching: false,
  })
}

const removeProvider = (idx: number) => {
  aiProviders.splice(idx, 1)
}

const onFetchModels = async (idx: number) => {
  const p = aiProviders[idx]
  if (!p.endpoint || !p.key) return
  p.fetching = true
  try {
    // Normalize: strip trailing slashes
    const base = p.endpoint.replace(/\/+$/, '')
    let url = ''
    const headers: Record<string, string> = {}
    if (p.format === 'openai') {
      // endpoint 含 /v1 时直接 /models，否则补 /v1/models
      url = /\/v\d/.test(base) ? `${base}/models` : `${base}/v1/models`
      headers['Authorization'] = `Bearer ${p.key}`
    } else if (p.format === 'anthropic') {
      // 避免重复 /v1：endpoint 已含 /v1 时直接 /models，否则补 /v1/models
      url = /\/v1/.test(base) ? `${base}/models` : `${base}/v1/models`
      headers['x-api-key'] = p.key
      headers['anthropic-version'] = '2023-06-01'
    } else if (p.format === 'gemini') {
      // 避免重复 /v1beta：endpoint 已含 /v1beta 时直接 /models，否则补 /v1beta/models
      url = /\/v1beta/.test(base) ? `${base}/models` : `${base}/v1beta/models`
      headers['x-goog-api-key'] = p.key
    }
    const resp = await fetch(url, { headers })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    const json = await resp.json()
    // 响应解析：统一尝试 OpenAI/Anthropic 兼容格式 json.data[].id 与 Gemini 格式 json.models[].name（去 models/ 前缀）
    const fromData = (json.data ?? []).map((m: any) => m.id).filter(Boolean)
    const fromModels = (json.models ?? []).map((m: any) => String(m.name).replace(/^models\//, '')).filter(Boolean)
    const models = (fromData.length ? fromData : fromModels).sort()
    p.modelOptions = models.map(m => ({ label: m, value: m }))
    message.success(`拉取成功：${models.length} 个模型`)
  } catch (e: any) {
    message.error(`拉取失败：${e.message || e}`)
  } finally {
    p.fetching = false
  }
}

const aiFieldKeys = [
  'ENABLE_NSFW_DETECTION', 'NSFW_SERVICE', 'NSFW_ENDPOINT', 'NSFW_API_KEY', 'NSFW_THRESHOLD',
  'AI_SUMMARY_ENABLED', 'AI_SUMMARY_PROVIDER', 'AI_SUMMARY_MODEL', 'ENABLE_SUMMARY',
]

const getDefaultValue = (key: string): any => {
  if (key === 'ENABLE_NSFW_DETECTION') return false
  if (key === 'AI_SUMMARY_ENABLED') return true
  if (key === 'ENABLE_SUMMARY') return true
  if (key === 'NSFW_THRESHOLD') return 0.5
  return ''
}

// Dynamic model options for each AI feature based on selected provider
const summaryModelOptions = computed(() => {
  const p = aiProviders.find(p => p.name === config.AI_SUMMARY_PROVIDER)
  return (p?.models || []).map((m: string) => ({ label: m, value: m }))
})

const isDirty = computed(() => {
  if (!savedConfig.value) return false
  for (const key of aiFieldKeys) {
    const cur = config[key]
    const orig = savedConfig.value[key]
    if (cur !== (orig ?? getDefaultValue(key))) return true
  }
  const rawSaved = savedConfig.value.AI_PROVIDERS ?? []
  const savedProviders = typeof rawSaved === 'string'
    ? (() => { try { const p = JSON.parse(rawSaved); return Array.isArray(p) ? p : [] } catch { return [] } })()
    : Array.isArray(rawSaved) ? rawSaved : []
  if (JSON.stringify(aiProviders.map(p => ({ name: p.name, format: p.format, endpoint: p.endpoint, key: p.key, models: p.models }))) !==
    JSON.stringify(savedProviders)) {
    return true
  }
  return false
})

const loadConfig = async () => {
  loading.value = true
  try {
    const { data } = await configApi.get()
    for (const key of aiFieldKeys) {
      config[key] = data[key] ?? getDefaultValue(key)
    }
    const rawProviders = data.AI_PROVIDERS ?? []
    const savedProviders: any[] = typeof rawProviders === 'string'
      ? (() => { try { const p = JSON.parse(rawProviders); return Array.isArray(p) ? p : [] } catch { return [] } })()
      : Array.isArray(rawProviders) ? rawProviders : []
    aiProviders.splice(0, aiProviders.length, ...savedProviders.map((p: any) => ({
      name: p.name ?? '',
      format: p.format ?? 'openai',
      endpoint: p.endpoint ?? '',
      key: p.key ?? '',
      models: p.models ?? [],
      modelOptions: (p.models ?? []).map((m: string) => ({ label: m, value: m })),
      fetching: false,
    })))
    savedConfig.value = JSON.parse(JSON.stringify({ ...data, AI_PROVIDERS: savedProviders }))
  } catch (e: any) {
    message.error('加载配置失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

const onSave = async () => {
  saving.value = true
  try {
    const payload: Record<string, any> = {}
    for (const key of aiFieldKeys) {
      payload[key] = config[key]
    }
    payload.AI_PROVIDERS = aiProviders.map(p => ({
      name: p.name, format: p.format, endpoint: p.endpoint, key: p.key, models: p.models,
    }))
    await configApi.save(payload)
    savedConfig.value = JSON.parse(JSON.stringify(payload))
    message.success('配置保存成功')
  } catch (e: any) {
    message.error('保存失败: ' + (e.message || ''))
  } finally {
    saving.value = false
  }
}

const onReset = () => {
  dialog.warning({
    title: '确认重置',
    content: '确定要重置 AI 配置为默认值吗？',
    positiveText: '重置',
    negativeText: '取消',
    onPositiveClick: async () => {
      loading.value = true
      try {
        await configApi.reset()
        await loadConfig()
        message.success('已重置')
      } catch (e: any) {
        message.error('重置失败: ' + (e.message || ''))
      } finally {
        loading.value = false
      }
    },
  })
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.ai-page { max-width: 900px; }

.section-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: var(--shadow-paper);
  transition: box-shadow 0.22s cubic-bezier(.22,.61,.36,1);
}
.section-card:hover { box-shadow: var(--shadow-lift); }
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--edge-soft);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper);
}
.section-icon { color: var(--accent); }
.section-body { padding: 18px; }

.form-field { margin-bottom: 16px; }
.form-field:last-child { margin-bottom: 0; }
.form-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  margin-bottom: 6px;
}
.field-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-3);
}

.switch-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.switch-field .form-label { margin-bottom: 0; }

.form-hint { font-size: 12px; color: var(--ink-3); margin: -8px 0 12px; line-height: 1.5; }

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider-row :deep(.n-slider) { flex: 1; }
.slider-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  min-width: 36px;
  text-align: right;
}

.empty-hint {
  text-align: center;
  padding: 32px 0;
  color: var(--ink-3);
  font-size: 14px;
}

.ai-provider-card {
  border: 1px solid var(--edge-soft);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
  background: var(--paper-2);
}

.ai-provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.provider-name-input { flex: 1; }

.ai-provider-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
@media (max-width: 600px) {
  .ai-provider-body { grid-template-columns: 1fr; }
}
.models-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.models-select { flex: 1; }

.save-bar {
  position: fixed;
  bottom: 24px;
  right: 32px;
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-lift);
  z-index: 100;
}
@media (max-width: 768px) {
  .save-bar {
    right: 16px;
    bottom: 16px;
  }
}
</style>
