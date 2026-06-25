<template>
  <div class="tk-root">
    <TkComments
      v-if="!isAdminPanel"
      :options="options"
      @admin="onAdmin"
      @comment-posted="onCommentPosted"
    />
    <TkAdmin
      v-else
      :options="options"
      @back="onBack"
    />
    <!-- 暗语输入后显示的管理入口 -->
    <div v-if="showAdminEntry && !isAdminPanel" class="tk-admin-entry">
      <button class="tk-admin-entry-btn" @click="onAdmin" title="管理">{{ t('admin') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { version } from '../version'
import { logger, t } from '../utils'
import { request } from '../utils/api'
import type { TakoioConfig, Comment } from '../types'
import TkComments from './components/TkComments.vue'

const TkAdmin = defineAsyncComponent(() => import('./components/TkAdmin.vue'))

interface Props {
  options: TakoioConfig
}

const props = defineProps<Props>()

const isAdminPanel = ref(false)
const showAdminEntry = ref(false)
const adminKeyEnabled = ref(false)
const adminKeyword = ref('')
let keyBuffer = ''

const onAdmin = (): void => { isAdminPanel.value = true }
const onBack = (): void => { isAdminPanel.value = false }

const onCommentPosted = (comment: Comment): void => {
  props.options.onCommentPosted?.(comment)
}

const checkAdminKeyword = (event: KeyboardEvent): void => {
  if (!adminKeyEnabled.value || !adminKeyword.value) return
  const target = event.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
  }
  if (event.key.length === 1) {
    keyBuffer += event.key
    if (keyBuffer.length > 20) keyBuffer = keyBuffer.slice(-20)
    if (keyBuffer.endsWith(adminKeyword.value)) {
      showAdminEntry.value = true
      keyBuffer = ''
    }
  }
}

// 从服务端配置读取管理员暗语开关
const loadKeyConfig = async () => {
  try {
    if (!props.options.envId) return
    const base = props.options.envId.replace(/\/$/, '')
    const res = await request(`${base}/api/admin/config`)
    const cfg = (res as any)?.data || {}
    adminKeyEnabled.value = !!cfg.ENABLE_ADMIN_KEYWORD
    adminKeyword.value = cfg.ADMIN_KEYWORD || ''
  } catch { /* ignore */ }
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    if (props.options.customCSS) {
      // Sanitize customCSS: block dangerous CSS injections
      const sanitized = props.options.customCSS
        .replace(/url\s*\(/gi, '/* url() blocked */')
        .replace(/expression\s*\(/gi, '/* expression() blocked */')
        .replace(/-moz-binding\s*:/gi, '/* -moz-binding blocked */')
        .replace(/javascript\s*:/gi, '/* javascript: blocked */')
      const style = document.createElement('style')
      style.textContent = sanitized
      document.head.appendChild(style)
    }
    await loadKeyConfig()
    window.addEventListener('keydown', checkAdminKeyword)
  }
  logger.log(`Takoio v${version} initialized`)
})
</script>

<style>
.tk-root {
  /* 品牌色 */
  --tk-brand: #0ea5e9;
  --tk-brand-hover: #0284c7;
  --tk-brand-light: rgba(14, 165, 233, 0.1);
  --tk-brand-ring: rgba(14, 165, 233, 0.4);

  /* 语义色 */
  --tk-success: #22c55e;
  --tk-warning: #f59e0b;
  --tk-danger: #ef4444;
  --tk-info: #94a3b8;

  /* 中性色（基于 inherit + opacity，自动适配宿主背景） */
  --tk-text: inherit;
  --tk-text-secondary: color-mix(in srgb, currentColor 60%, transparent);
  --tk-text-tertiary: color-mix(in srgb, currentColor 40%, transparent);
  --tk-border: color-mix(in srgb, currentColor 15%, transparent);
  --tk-border-strong: color-mix(in srgb, currentColor 25%, transparent);
  --tk-bg-subtle: color-mix(in srgb, currentColor 4%, transparent);
  --tk-bg-muted: color-mix(in srgb, currentColor 8%, transparent);

  /* 管理后台独立变量（保持浅色固定） */
  --tk-admin-bg: #ffffff;
  --tk-admin-text: #1e293b;
  --tk-admin-text-secondary: #64748b;
  --tk-admin-border: #e2e8f0;
  --tk-admin-hover: #f8fafc;

  /* Element Plus 主题对齐 */
  --el-color-primary: var(--tk-brand);
  --el-color-primary-light-3: var(--tk-brand-hover);
  --el-color-primary-light-5: var(--tk-brand-light);
  --el-border-radius-base: 6px;

  color: inherit;
  font-size: 14px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.tk-root a { color: var(--tk-brand); text-decoration: none; }
.tk-root a:hover { color: var(--tk-brand-hover); }
.tk-root button { cursor: pointer; font-family: inherit; }
.tk-root pre { overflow-x: auto; padding: 12px; background: rgba(0,0,0,0.04); border: 1px solid rgba(128,128,128,0.15); border-radius: 4px; }
.tk-root code { font-family: 'SF Mono', Monaco, Consolas, monospace; }

.tk-admin-entry {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
}
.tk-admin-entry-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--tk-brand);
  color: #fff;
  border: none;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.2s;
}
.tk-admin-entry-btn:hover {
  background: var(--tk-brand-hover);
  transform: scale(1.08);
}

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .tk-root *, .tk-root *::before, .tk-root *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
