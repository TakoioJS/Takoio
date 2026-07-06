<template>
  <div class="settings-page">
    <div class="settings-layout">
      <div
        ref="contentRef"
        class="settings-content"
      >
        <n-spin :show="loading">
          <div
            v-for="section in sections"
            :id="`section-${section.key}`"
            :key="section.key"
            class="config-section"
          >
            <div
              class="section-header"
              role="button"
              tabindex="0"
              :aria-expanded="!isCollapsed(section.key)"
              @click="toggleSection(section.key)"
              @keydown.enter="toggleSection(section.key)"
              @keydown.space.prevent="toggleSection(section.key)"
            >
              <h2 class="section-title">
                {{ section.label }}
              </h2>
              <n-icon
                size="16"
                class="collapse-icon"
              >
                <ChevronDownOutline v-if="!isCollapsed(section.key)" />
                <ChevronForwardOutline v-else />
              </n-icon>
            </div>

            <transition name="collapse">
              <div
                v-show="!isCollapsed(section.key)"
                class="section-body"
              >
                <!-- 普通配置项 -->
                <template v-if="section.key !== 'push' && section.key !== 'socialAuth'">
                  <template
                    v-for="(field, idx) in section.fields"
                    :key="field.key"
                  >
                    <div
                      v-if="!field.condition || field.condition(config)"
                      :class="['field-row', { 'full-row': isFullRow(field), 'last': isLastVisible(section, idx), 'switch-row': field.type === 'switch' }]"
                    >
                      <div class="field-label-col">
                        <div class="field-label">
                          {{ field.label }}
                          <n-tooltip
                            v-if="field.hint"
                            trigger="hover"
                          >
                            <template #trigger>
                              <n-icon
                                size="12"
                                class="help-icon"
                              >
                                <HelpCircleOutline />
                              </n-icon>
                            </template>
                            {{ field.hint }}
                          </n-tooltip>
                        </div>
                        <p
                          v-if="field.description"
                          class="field-desc"
                        >
                          {{ field.description }}
                        </p>
                      </div>
                      <div class="field-control-col">
                        <FieldRenderer
                          :field="field"
                          :model-value="config[field.key]"
                          :has-saved-value="!!savedConfig?.[field.key]"
                          :config="config"
                          @update:model-value="config[field.key] = $event"
                        />
                      </div>
                    </div>
                  </template>

                  <!-- 邮件测试 -->
                  <EmailTestPanel v-if="section.key === 'mail'" />
                </template>

                <!-- 推送通道配置 -->
                <template v-else-if="section.key === 'push'">
                  <div
                    v-for="key in push.active.value"
                    :key="key"
                    class="field-row"
                  >
                    <div class="field-label-col">
                      <div class="field-label">
                        {{ pushFieldLabel(key) }}
                      </div>
                    </div>
                    <div class="field-control-col push-control-col">
                      <SensitiveInput
                        v-model="config['PUSH_CHANNEL_' + key.toUpperCase()]"
                        :has-value="!!savedConfig?.['PUSH_CHANNEL_' + key.toUpperCase()]"
                        :placeholder="'输入 ' + pushFieldLabel(key) + ' 配置'"
                        style="flex: 1;"
                      />
                      <n-button
                        size="small"
                        quaternary
                        circle
                        type="error"
                        title="移除此通道"
                        @click="push.remove(key, () => { config['PUSH_CHANNEL_' + key.toUpperCase()] = '' })"
                      >
                        <template #icon>
                          <n-icon size="16">
                            <TrashOutline />
                          </n-icon>
                        </template>
                      </n-button>
                    </div>
                  </div>
                  <div
                    v-if="push.active.value.length === 0"
                    class="field-row empty-push-row"
                  >
                    <span class="empty-text">未启用任何推送通知通道</span>
                  </div>
                  <div
                    v-if="push.available.value.length > 0"
                    class="field-row add-push-row last"
                  >
                    <div class="field-label-col">
                      <div class="field-label">
                        添加推送通道
                      </div>
                      <p class="field-desc">
                        选择要启用的第三方推送平台
                      </p>
                    </div>
                    <div class="field-control-col add-push-controls">
                      <n-select
                        v-model:value="selectedPushKeyToAdd"
                        :options="push.available.value"
                        placeholder="选择推送平台..."
                        size="small"
                        style="flex: 1; max-width: 260px;"
                      />
                      <n-button
                        type="primary"
                        size="small"
                        :disabled="!selectedPushKeyToAdd"
                        @click="doAddPush"
                      >
                        <template #icon>
                          <n-icon><AddOutline /></n-icon>
                        </template>
                        启用
                      </n-button>
                    </div>
                  </div>
                </template>

                <!-- 社交登录配置 -->
                <template v-else-if="section.key === 'socialAuth'">
                  <div
                    v-for="provider in auth.active.value"
                    :key="provider"
                    class="field-row"
                  >
                    <div class="field-label-col">
                      <div class="field-label">
                        {{ authLabel(provider) }}
                      </div>
                    </div>
                    <div class="field-control-col push-control-col">
                      <n-switch
                        :value="config['SOCIAL_AUTH_' + provider.toUpperCase() + '_ENABLED']"
                        size="small"
                        @update:value="config['SOCIAL_AUTH_' + provider.toUpperCase() + '_ENABLED'] = $event"
                      />
                      <n-button
                        size="tiny"
                        type="error"
                        quaternary
                        @click="auth.remove(provider)"
                      >
                        <template #icon>
                          <n-icon><TrashOutline /></n-icon>
                        </template>
                      </n-button>
                    </div>
                  </div>
                  <div
                    v-if="auth.active.value.length === 0"
                    class="field-row empty-push-row"
                  >
                    <span class="empty-text">未启用任何社交登录方式</span>
                  </div>
                  <div
                    v-if="auth.available.value.length > 0"
                    class="field-row"
                  >
                    <div class="field-label-col">
                      <div class="field-label">
                        添加登录方式
                      </div>
                      <p class="field-desc">
                        选择要启用的社交登录提供商
                      </p>
                    </div>
                    <div class="field-control-col add-push-controls">
                      <n-select
                        v-model:value="selectedAuthToAdd"
                        :options="auth.available.value"
                        placeholder="选择登录方式..."
                        size="small"
                        style="flex: 1; max-width: 260px;"
                      />
                      <n-button
                        type="primary"
                        size="small"
                        :disabled="!selectedAuthToAdd"
                        @click="doAddAuth"
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

        <div
          v-if="isDirty"
          class="save-bar"
        >
          <n-button
            size="small"
            :disabled="loading"
            @click="onReset"
          >
            重置
          </n-button>
          <n-button
            v-if="isDirty"
            size="small"
            type="primary"
            :loading="saving"
            @click="onSave"
          >
            保存更改
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  NButton, NSelect, NSwitch, NSpin, NIcon, NTooltip, useMessage, useDialog,
} from 'naive-ui'
import { HelpCircleOutline, TrashOutline, AddOutline, ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { configApi } from '../../api/config'
import SensitiveInput from '../../components/SensitiveInput.vue'
import { sections as baseSections, type ConfigField, type ConfigSection } from './schema'
import { t } from '@shared/utils/i18n'
import { useDynamicList } from '../../composables/useDynamicList'
import FieldRenderer from './components/FieldRenderer.vue'
import EmailTestPanel from './components/EmailTestPanel.vue'

const message = useMessage()
const dialog = useDialog()
const contentRef = ref<HTMLElement | null>(null)

const loading = ref(false)
const saving = ref(false)
const config = reactive<Record<string, any>>({})
const savedConfig = ref<Record<string, any> | null>(null)

// AI Provider 动态选项
const aiProviderOptions = ref<{ label: string; value: string }[]>([])
const aiModelOptions = ref<{ label: string; value: string }[]>([])

// 本地 sections 副本，动态注入 options
const sections = computed<ConfigSection[]>(() => {
  return baseSections.map(section => {
    if (section.key !== 'security') return section
    return {
      ...section,
      fields: section.fields.map(field => {
        if (field.key === 'AUTO_AUDIT_AI_PROVIDER' && aiProviderOptions.value.length > 0) {
          return { ...field, options: aiProviderOptions.value }
        }
        if (field.key === 'AUTO_AUDIT_AI_MODEL' && aiModelOptions.value.length > 0) {
          return { ...field, options: aiModelOptions.value }
        }
        return field
      }),
    }
  })
})

// 卡片折叠状态
const collapsedSections = ref<Record<string, boolean>>({})
const toggleSection = (key: string) => {
  const val = collapsedSections.value[key]
  collapsedSections.value[key] = val === undefined ? false : !val
}
const isCollapsed = (key: string) => collapsedSections.value[key] === undefined ? true : collapsedSections.value[key]

// 推送通道
const selectedPushKeyToAdd = ref<string | null>(null)
const pushFields = computed(() => sections.value.find(s => s.key === 'push')?.fields || [])
const pushFieldLabel = (key: string) => pushFields.value.find(f => f.key === key)?.label || key
const push = useDynamicList({
  all: pushFields.value.map(f => f.key),
  initial: [],
  confirmRemove: false,
})
const doAddPush = () => {
  if (!selectedPushKeyToAdd.value) return
  push.add(selectedPushKeyToAdd.value)
  if (config[selectedPushKeyToAdd.value] === undefined || config[selectedPushKeyToAdd.value] === null) {
    config[selectedPushKeyToAdd.value] = ''
  }
  selectedPushKeyToAdd.value = null
}

// 社交登录
const selectedAuthToAdd = ref<string | null>(null)
const authLabel = (provider: string) =>
  provider === 'github' ? 'GitHub 登录' : provider === 'google' ? 'Google 登录' : '邮箱登录'
const auth = useDynamicList({
  all: ['github', 'google', 'email'],
  initial: ['email'],
  confirmRemove: true,
  confirmTitle: '确认停用',
  confirmContent: (key) => `确定要停用${authLabel(key)}吗？`,
})
const doAddAuth = () => {
  if (!selectedAuthToAdd.value) return
  auth.add(selectedAuthToAdd.value)
  config['SOCIAL_AUTH_' + selectedAuthToAdd.value.toUpperCase() + '_ENABLED'] = true
  selectedAuthToAdd.value = null
}

// 是否占满整行
const isFullRow = (field: ConfigField) => field.full || field.type === 'textarea' || field.type === 'checkbox-group'
const isLastVisible = (section: ConfigSection, idx: number) => {
  for (let i = idx + 1; i < section.fields.length; i++) {
    if (!section.fields[i].condition || section.fields[i].condition(config)) return false
  }
  return true
}

// 脏标记
const isDirty = computed(() => {
  if (!savedConfig.value) return false
  for (const section of sections.value) {
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

// AI Provider 选项
const parsedAiProviders = ref<any[]>([])
const updateAiProviderOptions = (rawProviders: any) => {
  const savedProviders: any[] = typeof rawProviders === 'string'
    ? (() => { try { const p = JSON.parse(rawProviders); return Array.isArray(p) ? p : [] } catch { return [] } })()
    : Array.isArray(rawProviders) ? rawProviders : []
  parsedAiProviders.value = savedProviders
  aiProviderOptions.value = savedProviders.map((p: any) => ({
    label: p.name || p.format || '未命名提供商',
    value: p.name,
  }))
  updateAiModelOptions(config.AUTO_AUDIT_AI_PROVIDER)
}
const updateAiModelOptions = (providerName: string) => {
  const provider = parsedAiProviders.value.find((p: any) => p.name === providerName)
  const models: string[] = provider?.models ?? []
  aiModelOptions.value = models.map((m: string) => ({ label: m, value: m }))
}

// 加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    const { data } = await configApi.get()
    Object.keys(config).forEach(k => delete config[k])

    const activePushKeys: string[] = []
    for (const section of sections.value) {
      for (const field of section.fields) {
        config[field.key] = data[field.key] ?? getDefaultValue(field)
        if (section.key === 'push' && data[field.key] !== undefined && data[field.key] !== null && data[field.key] !== '') {
          activePushKeys.push(field.key)
        }
      }
    }
    push.setActive(activePushKeys)

    // CODE_FEATURES: 直接信任 data 中的数组
    if (Array.isArray(data.CODE_FEATURES)) {
      config.CODE_FEATURES = data.CODE_FEATURES
    } else if (typeof data.CODE_FEATURES === 'string' && data.CODE_FEATURES) {
      try { config.CODE_FEATURES = JSON.parse(data.CODE_FEATURES) } catch { config.CODE_FEATURES = [] }
    } else {
      // 从 boolean 字段回退（向后兼容）
      config.CODE_FEATURES = []
      if (data.CODE_SHOW_LANGUAGE) config.CODE_FEATURES.push('language')
      if (data.CODE_SHOW_COPY) config.CODE_FEATURES.push('copy')
    }

    // COMMENT_FEATURES: 直接信任 data 中的数组
    if (Array.isArray(data.COMMENT_FEATURES)) {
      config.COMMENT_FEATURES = data.COMMENT_FEATURES
    } else if (typeof data.COMMENT_FEATURES === 'string' && data.COMMENT_FEATURES) {
      try { config.COMMENT_FEATURES = JSON.parse(data.COMMENT_FEATURES) } catch { config.COMMENT_FEATURES = [] }
    } else {
      config.COMMENT_FEATURES = []
      if (data.ENABLE_COMMENT_REACTION) config.COMMENT_FEATURES.push('commentReaction')
      if (data.ENABLE_ARTICLE_REACTION) config.COMMENT_FEATURES.push('articleReaction')
      if (data.ENABLE_LINK_INPUT) config.COMMENT_FEATURES.push('linkInput')
      if (data.SHOW_UA_INFO) config.COMMENT_FEATURES.push('uaInfo')
    }

    // PUSHOO_CHANNELS: parse JSON to individual fields
    if (data.PUSHOO_CHANNELS && typeof data.PUSHOO_CHANNELS === 'string') {
      try {
        const pushChannels = JSON.parse(data.PUSHOO_CHANNELS) as Record<string, string>
        for (const [channelName, channelValue] of Object.entries(pushChannels)) {
          config['PUSH_CHANNEL_' + channelName.toUpperCase()] = channelValue
        }
      } catch { /* ignore */ }
    }

    // AI_PROVIDERS
    const { data: rawAiProviders } = await configApi.privateKey.get('AI_PROVIDERS')
    updateAiProviderOptions(rawAiProviders)

    savedConfig.value = JSON.parse(JSON.stringify(data)) as any
    savedConfig.value.CODE_FEATURES = [...(config.CODE_FEATURES || [])]
    savedConfig.value.COMMENT_FEATURES = [...(config.COMMENT_FEATURES || [])]
  } catch (e: any) {
    message.error(t('loadConfigFailed') + ': ' + (e.message || ''))
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

// 保存配置
const onSave = async () => {
  if (config.SITE_URL && !/^(https?:\/\/)/i.test(config.SITE_URL)) {
    message.error(t('siteUrlInvalid')); return
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (config.MASTER && !emailPattern.test(config.MASTER)) { message.error(t('masterMailInvalid')); return }
  if (config.SENDER_EMAIL && !emailPattern.test(config.SENDER_EMAIL)) { message.error(t('senderMailInvalid')); return }
  if (config.SMTP_PORT) {
    const port = Number(config.SMTP_PORT)
    if (isNaN(port) || port < 1 || port > 65535) { message.error(t('smtpPortInvalid')); return }
  }

  saving.value = true
  try {
    const payload: Record<string, any> = {}
    for (const section of sections.value) {
      for (const field of section.fields) {
        let value = config[field.key]
        if (field.type === 'number' && (value === null || value === undefined)) {
          value = field.min ?? 0
        }
        payload[field.key] = value
      }
    }

    // Convert CODE_FEATURES→boolean 回填（向后兼容）
    const codeFeatures: string[] = config.CODE_FEATURES || []
    payload.CODE_SHOW_LANGUAGE = codeFeatures.includes('language')
    payload.CODE_SHOW_COPY = codeFeatures.includes('copy')
    delete payload.CODE_FEATURES

    // Convert COMMENT_FEATURES→JSON string（后端存储格式）
    const commentFeatures: string[] = config.COMMENT_FEATURES || []
    payload.COMMENT_FEATURES = JSON.stringify(commentFeatures)
    payload.ENABLE_ARTICLE_REACTION = commentFeatures.includes('articleReaction')
    payload.ENABLE_LINK_INPUT = commentFeatures.includes('linkInput')
    payload.SHOW_UA_INFO = commentFeatures.includes('uaInfo')

    // Serialize PUSH_CHANNEL_* → PUSHOO_CHANNELS JSON
    const pushChannels: Record<string, string> = {}
    const pushChannelPrefix = 'PUSH_CHANNEL_'
    for (const key of Object.keys(payload)) {
      if (key.startsWith(pushChannelPrefix)) {
        const channelName = key.slice(pushChannelPrefix.length).toLowerCase()
        if (payload[key]) pushChannels[channelName] = String(payload[key])
        delete payload[key]
      }
    }
    payload.PUSHOO_CHANNELS = JSON.stringify(pushChannels)

    const result = await configApi.save(payload) as { success: boolean; skipped?: Record<string, string> }
    await loadConfig()
    if (result.skipped && Object.keys(result.skipped).length > 0) {
      const details = Object.entries(result.skipped).map(([k, v]) => `${k}: ${v}`).join('；')
      message.warning(t('unsavedConfigWarning') + '：' + details)
    } else {
      message.success(t('configSuccess'))
    }
  } catch (e: any) {
    message.error(t('saveFailed') + ': ' + (e.message || ''))
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
        message.success(t('resetSuccess'))
      } catch (e: any) {
        message.error(t('resetFailed') + ': ' + (e.message || ''))
      } finally { loading.value = false }
    },
  })
}

onMounted(() => { loadConfig() })
</script>

<style scoped>
.settings-page { max-width: 100%; width: 100%; }
.settings-layout { display: block; }
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
  transition: background-color 0.2s;
}
.section-header:hover { background-color: var(--edge-soft); }
.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.collapse-icon { color: var(--ink-3); transition: color 0.2s; }
.section-header:hover .collapse-icon { color: var(--ink); }
.section-body { padding: 0 20px; border-top: 1px solid var(--edge-soft); }
@media (min-width: 768px) {
  .section-body { display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 40px; }
}
.field-row {
  display: flex; align-items: flex-start; gap: 24px;
  padding: 14px 0; border-bottom: 1px solid var(--edge-soft);
  width: 100%; box-sizing: border-box;
}
.field-row.last { border-bottom: none; }
.field-row.full-row { flex-direction: column; gap: 8px; }
@media (min-width: 768px) {
  .field-row { grid-column: span 2; }
  .field-row.switch-row { grid-column: span 1; }
}
.field-label-col { flex-shrink: 0; width: 180px; }
.field-row.full-row .field-label-col { width: 100%; }
.field-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 500; color: var(--ink); line-height: 22px;
}
.help-icon { color: var(--ink-3); cursor: help; }
.field-desc { margin: 2px 0 0; font-size: 12px; color: var(--ink-3); line-height: 1.5; }
.field-control-col { flex: 1; min-width: 0; }
.field-row.full-row .field-control-col { width: 100%; }
@media (max-width: 600px) {
  .field-row { flex-direction: column; gap: 6px; }
  .field-label-col { width: 100%; }
}
.push-control-col { display: flex; align-items: center; gap: 12px; }
.empty-push-row { justify-content: center; padding: 24px 0; }
.empty-text { font-size: 13px; color: var(--ink-3); }
.add-push-controls { display: flex; align-items: center; gap: 12px; }
.save-bar {
  position: fixed; bottom: 24px; right: 32px;
  display: flex; gap: 8px; padding: 10px 14px;
  background: var(--paper); border: 1px solid var(--edge-soft);
  border-radius: var(--r-card); box-shadow: var(--shadow-lift); z-index: 100;
}
@media (max-width: 768px) { .save-bar { right: 16px; bottom: 16px; } }
.collapse-enter-active, .collapse-leave-active {
  transition: max-height 0.22s, opacity 0.22s;
  max-height: 1500px; overflow: hidden;
}
.collapse-enter-from, .collapse-leave-to { max-height: 0; opacity: 0; }
</style>
