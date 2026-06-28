<template>
  <div class="settings-page">
    <div class="settings-layout">
      <!-- 主内容区 -->
      <div class="settings-content" ref="contentRef">
        <n-spin :show="loading">
          <div
            v-for="section in sections"
            :key="section.key"
            :id="`section-${section.key}`"
            class="config-section"
          >
            <!-- section 可折叠标题栏 -->
            <div class="section-header" @click="toggleSection(section.key)">
              <h2 class="section-title">{{ section.label }}</h2>
              <n-icon size="16" class="collapse-icon">
                <ChevronDownOutline v-if="!isCollapsed(section.key)" />
                <ChevronForwardOutline v-else />
              </n-icon>
            </div>

            <!-- 字段行列表 -->
            <transition name="collapse">
              <div v-show="!isCollapsed(section.key)" class="section-body">
                <!-- 普通非推送配置项 -->
                <template v-if="section.key !== 'push'">
                  <template v-for="(field, idx) in section.fields" :key="field.key">
                    <div
                      v-if="!field.condition || field.condition(config)"
                      :class="['field-row', { 'full-row': isFullRow(field), 'last': isLastVisible(section, idx), 'switch-row': field.type === 'switch' }]"
                    >
                      <!-- 左侧：label + hint/description -->
                      <div class="field-label-col">
                        <div class="field-label">
                          {{ field.label }}
                          <n-tooltip v-if="field.hint" trigger="hover">
                            <template #trigger>
                              <n-icon size="12" class="help-icon"><HelpCircleOutline /></n-icon>
                            </template>
                            {{ field.hint }}
                          </n-tooltip>
                        </div>
                        <p v-if="field.description" class="field-desc">{{ field.description }}</p>
                      </div>

                      <!-- 右侧：控件 -->
                      <div class="field-control-col">
                        <!-- Switch -->
                        <n-switch v-if="field.type === 'switch'" v-model:value="config[field.key]" size="small" />

                        <!-- Select / Tag-Select -->
                        <n-select
                          v-else-if="field.type === 'select' || field.type === 'tag-select'"
                          v-model:value="config[field.key]"
                          :options="field.options"
                          :clearable="!!field.clearable"
                          :filterable="field.filterable || field.type === 'tag-select'"
                          :tag="field.tag || field.type === 'tag-select'"
                          size="small"
                        />

                        <!-- Number -->
                        <n-input-number v-else-if="field.type === 'number'" v-model:value="config[field.key]" :min="field.min" :max="field.max" size="small" style="width: 100%" />

                        <!-- Color -->
                        <div v-else-if="field.type === 'color'" class="color-row">
                          <n-input v-model:value="config[field.key]" :placeholder="field.placeholder" size="small" />
                          <n-color-picker v-model:value="config[field.key]" :show-alpha="false" :swatches="colorSwatches" size="small" />
                        </div>

                        <!-- Slider -->
                        <div v-else-if="field.type === 'slider'" class="slider-row">
                          <n-slider v-model:value="config[field.key]" :min="field.min" :max="field.max" :step="field.step" :disabled="field.disabled?.(config)" size="small" />
                          <span class="slider-value">{{ config[field.key] }}</span>
                        </div>

                        <!-- Textarea -->
                        <n-input v-else-if="field.type === 'textarea'" v-model:value="config[field.key]" type="textarea" :rows="field.rows || 4" :placeholder="field.placeholder" size="small" />

                        <!-- Checkbox group -->
                        <n-checkbox-group v-else-if="field.type === 'checkbox-group'" v-model:value="config[field.key]">
                          <n-space>
                            <n-checkbox v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</n-checkbox>
                          </n-space>
                        </n-checkbox-group>

                        <!-- Sensitive input -->
                        <SensitiveInput
                          v-else-if="field.type === 'sensitive'"
                          v-model="config[field.key]"
                          :has-value="!!savedConfig?.[field.key]"
                          :placeholder="field.placeholder"
                        />

                        <!-- Input (default) -->
                        <n-input v-else v-model:value="config[field.key]" :placeholder="field.placeholder" size="small" />
                      </div>
                    </div>
                  </template>
                </template>

                <!-- 推送配置项列表：按需添加与显示 -->
                <template v-else>
                  <!-- 渲染已激活的推送通道 -->
                  <div
                    v-for="field in section.fields.filter(f => activePushKeys.includes(f.key))"
                    :key="field.key"
                    class="field-row"
                  >
                    <div class="field-label-col">
                      <div class="field-label">
                        {{ field.label }}
                      </div>
                      <p v-if="field.description" class="field-desc">{{ field.description }}</p>
                    </div>

                    <div class="field-control-col push-control-col">
                      <SensitiveInput
                        v-model="config[field.key]"
                        :has-value="!!savedConfig?.[field.key]"
                        :placeholder="field.placeholder"
                        style="flex: 1;"
                      />
                      <n-button
                        size="small"
                        quaternary
                        circle
                        type="error"
                        title="移除此通道"
                        @click="removePushChannel(field.key)"
                      >
                        <template #icon>
                          <n-icon size="16"><TrashOutline /></n-icon>
                        </template>
                      </n-button>
                    </div>
                  </div>

                  <!-- 暂无激活推送提示 -->
                  <div v-if="activePushKeys.length === 0" class="field-row empty-push-row">
                    <span class="empty-text">未启用任何推送通知通道</span>
                  </div>

                  <!-- 下拉框添加通道 -->
                  <div v-if="availablePushOptions.length > 0" class="field-row add-push-row last">
                    <div class="field-label-col">
                      <div class="field-label">添加推送通道</div>
                      <p class="field-desc">选择要启用的第三方推送平台</p>
                    </div>
                    <div class="field-control-col add-push-controls">
                      <n-select
                        v-model:value="selectedPushKeyToAdd"
                        :options="availablePushOptions"
                        placeholder="选择推送平台..."
                        size="small"
                        style="flex: 1; max-width: 260px;"
                      />
                      <n-button
                        type="primary"
                        size="small"
                        :disabled="!selectedPushKeyToAdd"
                        @click="addPushChannel"
                      >
                        <template #icon>
                          <n-icon><AddOutline /></n-icon>
                        </template>
                        启用
                      </n-button>
                    </div>
                  </div>
                </template>
              </div>
            </transition>
          </div>
        </n-spin>

        <!-- 浮动保存按钮栏 -->
        <div v-if="isDirty" class="save-bar">
          <n-button size="small" :disabled="loading" @click="onReset">重置</n-button>
          <n-button size="small" type="primary" :loading="saving" @click="onSave">保存更改</n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  NInput, NInputNumber, NSelect, NSwitch, NCheckbox, NCheckboxGroup,
  NSlider, NColorPicker, NButton, NSpin, NSpace, NIcon, NTooltip,
  useMessage, useDialog,
} from 'naive-ui'
import { HelpCircleOutline, TrashOutline, AddOutline, ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { configApi } from '../../api/config'
import SensitiveInput from '../../components/SensitiveInput.vue'
import { sections, type ConfigField, type ConfigSection } from './schema'

const message = useMessage()
const dialog = useDialog()
const contentRef = ref<HTMLElement | null>(null)

const loading = ref(false)
const saving = ref(false)
const config = reactive<Record<string, any>>({})
const savedConfig = ref<Record<string, any> | null>(null)

const colorSwatches = ['#18a058', '#2080f0', '#d03050', '#f0a020', '#8a2be2', '#ff6b6b', '#00bcd4', '#ff9800', '#795548', '#607d8b', '#333333', '#000000']

// 卡片折叠状态管理 (默认均折叠)
const collapsedSections = ref<Record<string, boolean>>({})

const toggleSection = (key: string) => {
  const val = collapsedSections.value[key]
  collapsedSections.value[key] = val === undefined ? false : !val
}

const isCollapsed = (key: string) => {
  const val = collapsedSections.value[key]
  return val === undefined ? true : val
}

// 动态推送通道逻辑
const activePushKeys = ref<string[]>([])
const selectedPushKeyToAdd = ref<string | null>(null)

const pushFields = computed(() => sections.find(s => s.key === 'push')?.fields || [])

const availablePushOptions = computed(() => {
  return pushFields.value
    .filter(f => !activePushKeys.value.includes(f.key))
    .map(f => ({ label: f.label, value: f.key }))
})

const addPushChannel = () => {
  if (!selectedPushKeyToAdd.value) return
  const key = selectedPushKeyToAdd.value
  if (!activePushKeys.value.includes(key)) {
    activePushKeys.value.push(key)
    if (config[key] === undefined || config[key] === null) {
      config[key] = ''
    }
  }
  selectedPushKeyToAdd.value = null
}

const removePushChannel = (key: string) => {
  dialog.warning({
    title: '确认停用',
    content: '确定要停用并清除该推送通道的配置吗？',
    positiveText: '停用',
    negativeText: '取消',
    onPositiveClick: () => {
      activePushKeys.value = activePushKeys.value.filter(k => k !== key)
      config[key] = ''
      message.info('通道已停用，保存后生效')
    },
  })
}

// 是否占满整行（textarea 等长字段）
const isFullRow = (field: ConfigField) => {
  return field.full || field.type === 'textarea' || field.type === 'checkbox-group'
}

// 是否是该 section 最后一个可见字段（用于去除底部分隔线）
const isLastVisible = (section: ConfigSection, idx: number) => {
  for (let i = idx + 1; i < section.fields.length; i++) {
    const f = section.fields[i]
    if (!f.condition || f.condition(config)) return false
  }
  return true
}

const isDirty = computed(() => {
  if (!savedConfig.value) return false
  for (const section of sections) {
    for (const field of section.fields) {
      const cur = config[field.key]
      const orig = savedConfig.value[field.key]
      if (Array.isArray(cur)) {
        if (JSON.stringify(cur) !== JSON.stringify(orig ?? [])) return true
      } else if (cur !== (orig ?? '')) {
        return true
      }
    }
  }
  return false
})

const parsedAiProviders = ref<any[]>([])

const updateAiProviderOptions = (rawProviders: any) => {
  const savedProviders: any[] = typeof rawProviders === 'string'
    ? (() => { try { const p = JSON.parse(rawProviders); return Array.isArray(p) ? p : [] } catch { return [] } })()
    : Array.isArray(rawProviders) ? rawProviders : []
  
  parsedAiProviders.value = savedProviders
  
  const options = savedProviders.map((p: any) => ({
    label: p.name || p.format || '未命名提供商',
    value: p.name,
  }))
  
  const securitySection = sections.find(s => s.key === 'security')
  if (securitySection) {
    const aiProviderField = securitySection.fields.find(f => f.key === 'AUTO_AUDIT_AI_PROVIDER')
    if (aiProviderField) {
      aiProviderField.options = options
    }
  }
  
  updateAiModelOptions(config.AUTO_AUDIT_AI_PROVIDER)
}

const updateAiModelOptions = (providerName: string) => {
  const provider = parsedAiProviders.value.find((p: any) => p.name === providerName)
  const models: string[] = provider?.models ?? []
  const options = models.map((m: string) => ({ label: m, value: m }))
  
  const securitySection = sections.find(s => s.key === 'security')
  if (securitySection) {
    const modelField = securitySection.fields.find(f => f.key === 'AUTO_AUDIT_AI_MODEL')
    if (modelField) {
      modelField.options = options
    }
  }
}

watch(() => config.AUTO_AUDIT_AI_PROVIDER, (val) => {
  updateAiModelOptions(val)
})

const loadConfig = async () => {
  loading.value = true
  try {
    const { data } = await configApi.get()
    Object.keys(config).forEach(k => delete config[k])
    
    const activeKeys: string[] = []
    for (const section of sections) {
      for (const field of section.fields) {
        config[field.key] = data[field.key] ?? getDefaultValue(field)
        if (section.key === 'push' && data[field.key] !== undefined && data[field.key] !== null && data[field.key] !== '') {
          activeKeys.push(field.key)
        }
      }
    }
    activePushKeys.value = activeKeys
    
    // 动态更新 AI 审核提供商选项
    updateAiProviderOptions(data.AI_PROVIDERS)
    
    savedConfig.value = JSON.parse(JSON.stringify(data))
  } catch (e: any) {
    message.error('加载配置失败: ' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

const getDefaultValue = (field: ConfigField): any => {
  switch (field.type) {
    case 'switch': return false
    case 'number': return field.min ?? 0
    case 'checkbox-group': return field.key === 'REQUIRED_FIELDS' ? ['nick'] : []
    case 'slider': return field.min ?? 0
    default: return ''
  }
}

const onSave = async () => {
  // 客户端表单格式校验
  if (config.SITE_URL) {
    if (!/^(https?:\/\/)/i.test(config.SITE_URL)) {
      message.error('站点地址格式错误，必须以 http:// 或 https:// 开头')
      return
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (config.MASTER && !emailPattern.test(config.MASTER)) {
    message.error('博主邮箱格式不正确')
    return
  }

  if (config.SENDER_EMAIL && !emailPattern.test(config.SENDER_EMAIL)) {
    message.error('发件人邮箱格式不正确')
    return
  }

  if (config.SMTP_PORT) {
    const port = Number(config.SMTP_PORT)
    if (isNaN(port) || port < 1 || port > 65535) {
      message.error('SMTP 端口必须是 1 到 65535 之间的有效端口号')
      return
    }
  }

  saving.value = true
  try {
    const payload: Record<string, any> = {}
    for (const section of sections) {
      for (const field of section.fields) {
        payload[field.key] = config[field.key]
      }
    }
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
    content: '确定要重置所有配置为默认值吗？此操作不可逆！',
    positiveText: '重置',
    negativeText: '取消',
    onPositiveClick: async () => {
      loading.value = true
      try {
        await configApi.reset()
        await loadConfig()
        message.success('已重置所有配置项')
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
.settings-page {
  max-width: 100%;
  width: 100%;
}

/* ---- 主布局：单栏居中 ---- */
.settings-layout {
  display: block;
}

/* ---- Section 卡片 ---- */
.config-section {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  margin-bottom: 16px;
  scroll-margin-top: 24px;
  overflow: hidden;
}
.section-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s cubic-bezier(.22,.61,.36,1);
}
.section-header:hover {
  background-color: var(--edge-soft);
}
.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
  font-family: var(--font-display);
}
.collapse-icon {
  color: var(--ink-3);
  transition: color 0.2s cubic-bezier(.22,.61,.36,1);
}
.section-header:hover .collapse-icon {
  color: var(--ink);
}

.section-body {
  padding: 0 20px;
  border-top: 1px solid var(--edge-soft);
}

@media (min-width: 768px) {
  .section-body {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    column-gap: 40px;
  }
}

/* ---- 字段行 ---- */
.field-row {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 14px 0;
  border-bottom: 1px solid var(--edge-soft);
  width: 100%;
  box-sizing: border-box;
}
.field-row.last { border-bottom: none; }
.field-row.full-row {
  flex-direction: column;
  gap: 8px;
}

@media (min-width: 768px) {
  .field-row {
    grid-column: span 2;
  }
  .field-row.switch-row {
    grid-column: span 1;
  }
}
.field-label-col {
  flex-shrink: 0;
  width: 180px;
}
.field-row.full-row .field-label-col {
  width: 100%;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  line-height: 22px;
}
.help-icon {
  color: var(--ink-3);
  cursor: help;
}
.field-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-3);
  line-height: 1.5;
}

.field-control-col {
  flex: 1;
  min-width: 0;
}
.field-row.full-row .field-control-col {
  width: 100%;
}

@media (max-width: 600px) {
  .field-row {
    flex-direction: column;
    gap: 6px;
  }
  .field-label-col {
    width: 100%;
  }
}

/* ---- 颜色 ---- */
.color-row {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 280px;
}
.color-row .n-input {
  flex: 1;
}
.color-row :deep(.n-color-picker) {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

/* ---- 滑块 ---- */
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider-row :deep(.n-slider) {
  flex: 1;
}
.slider-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  min-width: 30px;
  text-align: right;
}

/* ---- 推送通道及添加样式 ---- */
.push-control-col {
  display: flex;
  align-items: center;
  gap: 12px;
}
.empty-push-row {
  justify-content: center;
  padding: 24px 0;
  border-bottom: 1px solid var(--edge-soft);
}
.empty-text {
  font-size: 13px;
  color: var(--ink-3);
}
.add-push-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ---- 浮动保存按钮 ---- */
.save-bar {
  position: fixed;
  bottom: 24px;
  right: 32px;
  display: flex;
  gap: 8px;
  padding: 10px 14px;
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

/* ---- 卡片折叠过渡动画 ---- */
.collapse-enter-active, .collapse-leave-active {
  transition: max-height 0.22s cubic-bezier(.22,.61,.36,1), opacity 0.22s cubic-bezier(.22,.61,.36,1);
  max-height: 1500px;
  overflow: hidden;
}
.collapse-enter-from, .collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
