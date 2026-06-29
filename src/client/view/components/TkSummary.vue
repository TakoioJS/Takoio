<template>
  <div class="tk-summary" v-if="state !== 'hidden'">
    <!-- Loading skeleton -->
    <div v-if="state === 'loading'" class="tk-summary-card">
      <div class="tk-summary-header">
        <span class="tk-summary-icon">✦</span>
        <span class="tk-summary-title">{{ t('aiSummaryTitle') }}</span>
      </div>
      <div class="tk-summary-skeleton">
        <div class="tk-skeleton-line" style="width: 100%" />
        <div class="tk-skeleton-line" style="width: 92%" />
        <div class="tk-skeleton-line" style="width: 68%" />
      </div>
    </div>

    <!-- Success -->
    <div v-else-if="state === 'success'" class="tk-summary-card" :class="{ collapsed }">
      <div class="tk-summary-header" @click="toggleCollapse">
        <span class="tk-summary-icon">✦</span>
        <span class="tk-summary-title">{{ t('aiSummaryTitle') }}</span>
        <button class="tk-summary-toggle" :aria-label="collapsed ? t('show') : t('hide')">
          <svg v-if="collapsed" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
        </button>
      </div>
      <div v-show="!collapsed" class="tk-summary-body" v-html="renderedSummary" />
      <div v-show="!collapsed && keywords.length > 0" class="tk-summary-keywords">
        <span class="tk-keywords-label">{{ t('aiKeywords') }}：</span>
        <span v-for="kw in keywords" :key="kw" class="tk-keyword-tag">{{ kw }}</span>
      </div>
    </div>

    <!-- Error: minimal, non-disruptive -->
    <div v-else class="tk-summary-card tk-summary-error">
      <span class="tk-summary-icon">✦</span>
      <span>{{ t('aiSummaryFailed') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getArticleSummary } from '../../utils/api'
import { marked } from '../../utils/marked'
import { t } from '../../utils/i18n'
import { getUrl } from '../../utils'
import type { TakoioConfig } from '../../types'

interface Props {
  options: TakoioConfig
}
const props = defineProps<Props>()

type State = 'loading' | 'success' | 'error' | 'hidden'
const state = ref<State>('loading')
const renderedSummary = ref('')
const keywords = ref<string[]>([])
const collapsed = ref(false)

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const generateSummary = async () => {
  if (!props.options.articleContent || !props.options.enableSummary) {
    state.value = 'hidden'
    return
  }

  state.value = 'loading'
  try {
    const url = getUrl(props.options.path)
    const result = await getArticleSummary(props.options.envId, {
      content: props.options.articleContent,
      url,
      title: props.options.title,
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
}

onMounted(generateSummary)

watch(() => props.options.articleContent, generateSummary)
</script>

<style scoped>
.tk-summary {
  margin-bottom: 20px;
  /* Sticky: when scrolling through many comments, the summary stays at the top of the viewport */
  position: sticky;
  top: 0;
  z-index: 10;
}

.tk-summary-card {
  background: var(--tk-bg-subtle);
  border: 1px solid var(--tk-border-soft);
  border-radius: var(--tk-r-card);
  padding: 16px 18px;
  /* Ensure sticky element has a solid backdrop so comments don't show through */
  backdrop-filter: blur(8px);
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
