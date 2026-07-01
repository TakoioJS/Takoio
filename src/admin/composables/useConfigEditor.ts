/**
 * useConfigEditor — 通用配置编辑器 composable
 *
 * 统一配置加载、保存、脏检测、重置逻辑，消除 Settings.vue / Ai.vue 中的重复代码。
 * 设计原则：
 * 1. 各页面只需提供关心的字段 keys 和可选的自定义 payload 构建逻辑
 * 2. 保存成功后自动从后端重新加载，确保 savedConfig 与实际存储一致
 * 3. number 字段 null 值自动转为默认值，避免后端类型校验静默跳过
 */

import { reactive, ref, computed } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import { configApi } from '../api/config'
import type { ConfigField, ConfigSection } from '../views/settings/schema'

export interface UseConfigEditorOptions {
  /** 本页面关心的配置字段 key 列表 */
  fieldKeys: string[]
  /** 从 sections 获取字段信息（用于 number 类型 null 处理等） */
  getSections?: () => ConfigSection[]
  /** 自定义 payload 构建逻辑，返回最终提交给后端的 config 对象 */
  buildPayload?: (config: Record<string, unknown>) => Record<string, unknown>
  /** 自定义从后端 data 中加载配置到 config 的逻辑 */
  onLoad?: (config: Record<string, unknown>, data: Record<string, unknown>) => void
  /** 自定义脏检测逻辑，返回 true 表示有变更 */
  isDirtyOverride?: (config: Record<string, unknown>, savedConfig: Record<string, unknown>) => boolean
}

export function useConfigEditor(options: UseConfigEditorOptions) {
  const message = useMessage()
  const dialog = useDialog()

  const loading = ref(false)
  const saving = ref(false)
  const config = reactive<Record<string, unknown>>({})
  const savedConfig = ref<Record<string, unknown> | null>(null)

  /** 获取字段默认值 */
  const getDefaultValue = (field: ConfigField): unknown => {
    switch (field.type) {
      case 'switch': return false
      case 'number': return field.min ?? 0
      case 'slider': return field.min ?? 0
      case 'checkbox-group': return field.key === 'REQUIRED_FIELDS' ? ['nick'] : []
      default: return ''
    }
  }

  /** 通过 key 查找字段定义（跨 sections） */
  const findField = (key: string): ConfigField | undefined => {
    if (!options.getSections) return undefined
    for (const section of options.getSections()) {
      const field = section.fields.find(f => f.key === key)
      if (field) return field
    }
    return undefined
  }

  /** 加载配置 */
  const loadConfig = async () => {
    loading.value = true
    try {
      const { data } = await configApi.get()
      // 清除旧值
      Object.keys(config).forEach(k => delete config[k])
      // 填充新值
      for (const key of options.fieldKeys) {
        if (options.onLoad) {
          // 自定义加载逻辑会处理这些 key
        } else {
          const field = findField(key)
          config[key] = data[key] ?? (field ? getDefaultValue(field) : '')
        }
      }
      // 执行自定义加载回调
      if (options.onLoad) {
        options.onLoad(config, data)
      }
      savedConfig.value = JSON.parse(JSON.stringify(config))
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      message.error('加载配置失败: ' + err.message)
    } finally {
      loading.value = false
    }
  }

  /** 脏检测 */
  const isDirty = computed(() => {
    if (!savedConfig.value) return false
    if (options.isDirtyOverride) {
      return options.isDirtyOverride(config, savedConfig.value)
    }
    for (const key of options.fieldKeys) {
      const cur = config[key]
      const orig = savedConfig.value[key]
      if (Array.isArray(cur)) {
        if (JSON.stringify(cur) !== JSON.stringify(orig ?? [])) return true
      } else if (cur !== (orig ?? '')) {
        return true
      }
    }
    return false
  })

  /** 保存配置 */
  const onSave = async () => {
    saving.value = true
    try {
      let payload: Record<string, unknown>

      if (options.buildPayload) {
        payload = options.buildPayload(config)
      } else {
        payload = {}
        const sections = options.getSections?.() ?? []
        for (const section of sections) {
          for (const field of section.fields) {
            let value = config[field.key]
            // Naive UI n-input-number 清空后返回 null，需转为默认值
            if (field.type === 'number' && (value === null || value === undefined)) {
              value = field.min ?? 0
            }
            payload[field.key] = value
          }
        }
      }

      const result = await configApi.save(payload) as { success: boolean; skipped?: Record<string, string> }
      // 重新从后端加载配置，确保 savedConfig 与实际存储一致
      await loadConfig()
      if (result.skipped && Object.keys(result.skipped).length > 0) {
        const details = Object.entries(result.skipped).map(([k, v]) => `${k}: ${v}`).join('；')
        message.warning(`部分配置项未保存：${details}`)
      } else {
        message.success('配置保存成功')
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      message.error('保存失败: ' + err.message)
    } finally {
      saving.value = false
    }
  }

  /** 重置配置 */
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
        } catch (e: unknown) {
          const err = e instanceof Error ? e : new Error(String(e))
          message.error('重置失败: ' + err.message)
        } finally {
          loading.value = false
        }
      },
    })
  }

  return {
    loading,
    saving,
    config,
    savedConfig,
    isDirty,
    loadConfig,
    onSave,
    onReset,
    getDefaultValue,
  }
}
