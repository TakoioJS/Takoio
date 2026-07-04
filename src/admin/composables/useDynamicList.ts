/**
 * useDynamicList — 动态列表 CRUD 模式
 *
 * 消除 Settings.vue 中推送通道和社交登录的重复"添加/删除/激活列表"逻辑。
 * 两种场景共享同一模式：初始列表 → 添加选项 → 移除选项 → 可用选项计算。
 *
 * 用法：
 * ```ts
 * // 推送通道
 * const push = useDynamicList({
 *   all: ['serverChan', 'bark', 'telegram', ...],
 *   initial: config.PUSHOO_CHANNELS ? Object.keys(JSON.parse(config.PUSHOO_CHANNELS)) : [],
 *   label: (key) => key === 'serverChan' ? 'Server酱' : key,
 * })
 *
 * // 社交登录
 * const auth = useDynamicList({
 *   all: ['github', 'google', 'email'],
 *   initial: ['email'],
 *   label: (key) => key === 'github' ? 'GitHub' : key === 'google' ? 'Google' : '邮箱',
 * })
 * // auth.active → ref(['email'])
 * // auth.available → computed([{ label: 'GitHub', value: 'github' }, { label: 'Google', value: 'google' }])
 * // auth.add('github') → active now ['email', 'github']
 * // auth.remove('email') → active now ['github']
 * ```
 */

import { ref, computed } from 'vue'
import { useDialog } from 'naive-ui'

export type DynamicListOptions = {
  /** 所有可选值 */
  all: string[]
  /** 初始已激活值 */
  initial?: string[]
  /** 值 → 显示标签的映射函数 */
  label?: (key: string) => string
  /** 选项组标签（可选，用于分组展示） */
  groupLabel?: string
  /** 移除时是否弹确认对话框 */
  confirmRemove?: boolean
  /** 移除确认对话框标题 */
  confirmTitle?: string
  /** 移除确认对话框内容 */
  confirmContent?: (key: string) => string
}

export function useDynamicList (options: DynamicListOptions) {
  const {
    all,
    initial = [],
    label = (k) => k,
    confirmRemove = true,
    confirmTitle = '确认停用',
    confirmContent = (key) => `确定要停用"${label(key)}"吗？`,
  } = options

  const dialog = useDialog()
  const active = ref<string[]>([...initial])

  /** 当前可添加的选项 */
  const available = computed(() =>
    all
      .filter(k => !active.value.includes(k))
      .map(k => ({ label: label(k), value: k }))
  )

  /** 添加一项 */
  const add = (key: string) => {
    if (!active.value.includes(key)) {
      active.value.push(key)
    }
  }

  /** 移除一项（含确认对话框） */
  const remove = (key: string, onConfirmed?: () => void) => {
    if (!confirmRemove) {
      active.value = active.value.filter(k => k !== key)
      onConfirmed?.()
      return
    }
    dialog.warning({
      title: confirmTitle,
      content: confirmContent(key),
      positiveText: '停用',
      negativeText: '取消',
      onPositiveClick: () => {
        active.value = active.value.filter(k => k !== key)
        onConfirmed?.()
      },
    })
  }

  /** 批量设置活跃列表 */
  const setActive = (keys: string[]) => {
    active.value = [...keys]
  }

  return { active, available, add, remove, setActive }
}