<template>
  <!-- renderOnly 模式：不渲染内置 UI，仅取数并通过 renderSummary 回调通知宿主 -->
  <div
    v-if="!renderOnly"
    v-show="state !== 'hidden'"
    class="tk-summary"
  >
    <!-- Loading skeleton -->
    <div
      v-if="state === 'loading'"
      class="tk-summary-card"
    >
      <div class="tk-summary-header">
        <span class="tk-summary-icon">✦</span>
        <span class="tk-summary-title">{{ t('aiSummaryTitle') }}</span>
      </div>
      <div class="tk-summary-skeleton">
        <div
          class="tk-skeleton-line"
          style="width: 100%"
        />
        <div
          class="tk-skeleton-line"
          style="width: 92%"
        />
        <div
          class="tk-skeleton-line"
          style="width: 68%"
        />
      </div>
    </div>

    <!-- Success -->
    <div
      v-else-if="state === 'success'"
      class="tk-summary-card"
      :class="{ collapsed }"
    >
      <div
        class="tk-summary-header"
        @click="toggleCollapse"
      >
        <span class="tk-summary-icon">✦</span>
        <span class="tk-summary-title">{{ t('aiSummaryTitle') }}</span>
        <button
          class="tk-summary-toggle"
          :aria-label="collapsed ? t('show') : t('hide')"
        >
          <svg
            v-if="collapsed"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><polyline points="6 9 12 15 18 9" /></svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><polyline points="18 15 12 9 6 15" /></svg>
        </button>
      </div>
      <div
        v-show="!collapsed"
        class="tk-summary-body"
        v-html="renderedSummary"
      />
      <div
        v-show="!collapsed && keywords.length > 0"
        class="tk-summary-keywords"
      >
        <span class="tk-keywords-label">{{ t('aiKeywords') }}：</span>
        <span
          v-for="kw in keywords"
          :key="kw"
          class="tk-keyword-tag"
        >{{ kw }}</span>
      </div>
    </div>

    <!-- Error: minimal, non-disruptive -->
    <div
      v-else
      class="tk-summary-card tk-summary-error"
    >
      <span class="tk-summary-icon">✦</span>
      <span>{{ t('aiSummaryFailed') }}</span>
      <button
        class="tk-summary-retry"
        @click="generateSummary"
      >
        {{ t('aiSummaryRetry') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, inject, type Ref } from 'vue'
import { getArticleSummary } from '../../utils'
import { marked } from '../../utils/marked'
import { t } from '../../utils/i18n'
import { getUrl } from '../../utils'
import type { TakoioConfig } from '../../types'

interface Props {
  options: TakoioConfig
  /** 仅取数模式：不渲染内置卡片，通过 options.renderSummary 回调通知宿主 */
  renderOnly?: boolean
}
const props = defineProps<Props>()

// 从 App.vue 注入后台公开配置（ENABLE_SUMMARY 等）；TkComments 在拿到 config 后更新此 ref
const siteConfig = inject<Ref<Record<string, any>>>('takoio-site-config', ref({}))

type State = 'loading' | 'success' | 'error' | 'hidden'
const state = ref<State>('loading')
const renderedSummary = ref('')
const keywords = ref<string[]>([])
const collapsed = ref(false)

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

// 后台开关：ENABLE_SUMMARY 默认 true，仅显式 false 才禁用
const serverEnabled = () => siteConfig.value?.ENABLE_SUMMARY !== false

/** 通知宿主自定义渲染回调（renderOnly 模式下使用） */
const notifyHost = () => {
  if (!props.options.renderSummary) return
  props.options.renderSummary({
    summary: renderedSummary.value,
    keywords: keywords.value,
    loading: state.value === 'loading',
    error: state.value === 'error' ? t('aiSummaryFailed') : null,
    retry: generateSummary,
  })
}

let lastFetchedContent = ''
let lastFetchedUrl = ''
let lastFetchedTitle = ''
let lastFetchedEnabled = false

const generateSummary = async () => {
  const enabled = !!props.options.articleContent && !!props.options.enableSummary && serverEnabled()
  if (!enabled) {
    state.value = 'hidden'
    notifyHost()
    return
  }

  const url = getUrl(props.options.path, { pathNormalize: props.options.pathNormalize, pathTransform: props.options.pathTransform })
  const content = props.options.articleContent || ''
  const title = props.options.title || ''

  if (
    (state.value === 'success' || state.value === 'loading') &&
    lastFetchedContent === content &&
    lastFetchedUrl === url &&
    lastFetchedTitle === title &&
    lastFetchedEnabled === enabled
  ) {
    return
  }

  lastFetchedContent = content
  lastFetchedUrl = url
  lastFetchedTitle = title
  lastFetchedEnabled = enabled

  state.value = 'loading'
  notifyHost()
  try {
    const result = await getArticleSummary(props.options.envId, {
      content,
      url,
      title,
    })

    if (result.success && result.summary) {
      renderedSummary.value = await marked(result.summary)
      keywords.value = result.keywords || []
      state.value = 'success'
    } else {
      state.value = 'error'
    }
  } catch {
    state.value = 'error'
  }
  notifyHost()
}

onMounted(generateSummary)

watch(() => props.options.articleContent, generateSummary)
// 后台开关变化时重新评估显隐
watch(siteConfig, () => generateSummary(), { deep: true })
</script>

<style scoped>
.tk-summary {
  margin-bottom: 20px;
}

.tk-summary-card {
  background: var(--tk-bg-subtle);
  border: 1px solid var(--tk-border-soft);
  border-radius: var(--tk-r-card);
  padding: 16px 18px;
}

.tk-summary-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tk-text-2);
  cursor: pointer;
  user-select: none;
}

.tk-summary-icon {
  color: var(--tk-brand);
  font-size: 15px;
}

.tk-summary-title {
  letter-spacing: 0.02em;
  flex: 1;
}

.tk-summary-toggle {
  background: none;
  border: none;
  color: var(--tk-text-3);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
}
.tk-summary-toggle:hover {
  color: var(--tk-text-2);
  background: var(--tk-bg-muted);
}

.tk-summary-body {
  font-size: var(--tk-fs-base);
  line-height: var(--tk-lh);
  color: var(--tk-text);
}

.tk-summary-body :deep(p) {
  margin: 0 0 8px;
}
.tk-summary-body :deep(p:last-child) {
  margin-bottom: 0;
}

.tk-summary-keywords {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--tk-border-soft);
}

.tk-keywords-label {
  font-size: 12px;
  color: var(--tk-text-3);
}

.tk-keyword-tag {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  border-radius: var(--tk-r-pill);
  background: var(--tk-brand-light);
  color: var(--tk-brand);
  border: 1px solid var(--tk-brand-ring);
}

/* Skeleton */
.tk-summary-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tk-skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--tk-bg-muted) 25%,
    var(--tk-bg-inset) 50%,
    var(--tk-bg-muted) 75%
  );
  background-size: 200% 100%;
  animation: tk-shimmer 1.4s infinite;
}

@keyframes tk-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error */
.tk-summary-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--tk-text-3);
  padding: 10px 14px;
}

.tk-summary-retry {
  margin-left: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 13px;
  color: var(--tk-text-3);
  text-decoration: underline;
}
.tk-summary-retry:hover {
  color: var(--tk-text-2);
}

/* Collapsed state: compact bar */
.tk-summary-card.collapsed {
  padding: 10px 14px;
}
.tk-summary-card.collapsed .tk-summary-header {
  margin-bottom: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tk-skeleton-line { animation: none; }
}
</style>
