<template>
  <div
    class="tk-root"
    :data-theme="isDark ? 'dark' : 'light'"
  >
    <TkSummary
      v-if="showSummary"
      :options="options"
    />
    <TkSummary
      v-else-if="showSummaryHostOnly"
      :options="options"
      render-only
    />
    <TkComments
      :options="options"
      @comment-posted="onCommentPosted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue'
import { version } from '../utils'
import { logger } from '../utils'
import type { TakoioConfig, Comment as TakoioComment } from '../types'
import TkComments from './components/TkComments.vue'
import TkSummary from './components/TkSummary.vue'

interface Props {
  options: TakoioConfig
}

const props = defineProps<Props>()

// 后台公开配置（由 TkComments 在拉取评论后回填）；摘要双控依赖此 ref
const siteConfig = ref<Record<string, any>>({})
provide('takoio-site-config', siteConfig)

// 摘要显隐双控：后台 ENABLE_SUMMARY（默认 true，仅显式 false 禁用）× 宿主 enableSummary × 有 articleContent
// 内置卡片渲染：未传 renderSummary
const showSummary = computed(() =>
  !props.options.renderSummary &&
  siteConfig.value?.ENABLE_SUMMARY !== false &&
  !!props.options.enableSummary &&
  !!props.options.articleContent
)
// 宿主自定义渲染：传了 renderSummary 且开关均开
const showSummaryHostOnly = computed(() =>
  !!props.options.renderSummary &&
  siteConfig.value?.ENABLE_SUMMARY !== false &&
  !!props.options.enableSummary &&
  !!props.options.articleContent
)

const onCommentPosted = (comment: TakoioComment): void => {
  props.options.onCommentPosted?.(comment)
}

const isDark = ref(false)

const checkTheme = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const body = document.body
  const html = document.documentElement

  const hasDarkClass = body.classList.contains('dark') ||
                       body.classList.contains('dark-mode') ||
                       body.getAttribute('data-theme') === 'dark' ||
                       html.classList.contains('dark') ||
                       html.classList.contains('dark-mode') ||
                       html.getAttribute('data-theme') === 'dark'

  if (hasDarkClass) {
    isDark.value = true
    return
  }

  const hasLightClass = body.classList.contains('light') ||
                        body.classList.contains('light-mode') ||
                        body.getAttribute('data-theme') === 'light' ||
                        html.classList.contains('light') ||
                        html.classList.contains('light-mode') ||
                        html.getAttribute('data-theme') === 'light'

  if (hasLightClass) {
    isDark.value = false
    return
  }

  // Fallback to computed text color of document body
  // If the text color has high brightness (light text), the background must be dark -> dark theme
  const bodyStyle = window.getComputedStyle(body)
  const textColor = bodyStyle.color
  const match = textColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    isDark.value = yiq > 150
  } else {
    // Fallback to prefers-color-scheme
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
}

let observer: MutationObserver | null = null
let mediaQuery: MediaQueryList | null = null

onMounted(() => {
  if (typeof window !== 'undefined') {
    checkTheme()

    // MutationObserver to watch class/data-theme changes on body and html
    observer = new MutationObserver(checkTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })

    // MediaQueryList listener for prefers-color-scheme changes
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', checkTheme)
    } else {
      mediaQuery.addListener(checkTheme)
    }
  }

  if (typeof window !== 'undefined' && props.options.customCSS) {
    // 3 层纵深防御：解码 CSS hex 转义 → 剥离 CSS 注释 → 黑名单拒止
    // 注意：黑名单方案固有局限，完全安全仍需服务端 PostCSS AST 白名单
    const decodeCssEscapes = (css: string) =>
      css.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)))
    const stripComments = (css: string) =>
      css.replace(/\/\*[\s\S]*?\*\//g, '')
    const sanitized = stripComments(decodeCssEscapes(props.options.customCSS))
      .replace(/expression\s*\([^)]*\)/gi, '/* expression() blocked */')  // IE XSS (最高危害)
      .replace(/javascript\s*:/gi, '/* javascript: blocked */')           // javascript: URI
      .replace(/vbscript\s*:/gi, '/* vbscript: blocked */')               // vbscript: URI
      .replace(/url\s*\([^)]*\)/gi, '/* url() blocked */')                // 禁止所有 url()
      .replace(/@import/gi, '/* @import blocked */')                      // 禁止 @import
      .replace(/-moz-binding\s*:/gi, '/* -moz-binding blocked */')        // XBL binding
      .replace(/behavior\s*:/gi, '/* behavior blocked */')                // IE behavior
      .replace(/@keyframes\s+[^{]*\{/gi, '/* @keyframes blocked */')      // @keyframes 可滥用
      .replace(/pointer-events?\s*:/gi, '/* pointer-events blocked */')   // 可遮挡按钮
    const style = document.createElement('style')
    style.textContent = sanitized
    style.setAttribute('data-takoio-custom-css', '') // 标记来源便于审计
    document.head.appendChild(style)
  }
  logger.log(`Takoio v${version} initialized`)
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
  }
  if (mediaQuery) {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', checkTheme)
    } else {
      mediaQuery.removeListener(checkTheme)
    }
  }
})
</script>

<style>
.tk-root{
  /* —— 强调：松绿系（可被 options.brandColor 覆盖，见 index.ts:84）—— */
  --tk-brand:#5E8C6A; --tk-brand-hover:#52815C;
  --tk-brand-light: rgba(94, 140, 106, 0.12);
  --tk-brand-light:color-mix(in srgb,var(--tk-brand) 12%,transparent);
  --tk-brand-ring: rgba(94, 140, 106, 0.38);
  --tk-brand-ring: color-mix(in srgb,var(--tk-brand) 38%,transparent);

  /* —— 语义：颜料级降饱和 —— */
  --tk-success:#5E8C6A; --tk-warning:#B98A4B; --tk-danger:#B0524F;
  --tk-info: rgba(0, 0, 0, 0.55);
  --tk-info:color-mix(in srgb,currentColor 55%,transparent);

  /* —— 纸的呼吸：中性层次（沿用 currentColor 派生，零侵入宿主）—— */
  --tk-text:inherit;
  --tk-text-2: rgba(0, 0, 0, 0.62);
  --tk-text-2:color-mix(in srgb,currentColor 62%,transparent);
  --tk-text-3: rgba(0, 0, 0, 0.42);
  --tk-text-3:color-mix(in srgb,currentColor 42%,transparent);
  --tk-border: rgba(0, 0, 0, 0.12);
  --tk-border:color-mix(in srgb,currentColor 12%,transparent);
  --tk-border-soft: rgba(0, 0, 0, 0.07);
  --tk-border-soft:color-mix(in srgb,currentColor 7%,transparent);
  --tk-bg-subtle: rgba(0, 0, 0, 0.03);
  --tk-bg-subtle:color-mix(in srgb,currentColor 3%,transparent);
  --tk-bg-muted: rgba(0, 0, 0, 0.06);
  --tk-bg-muted:color-mix(in srgb,currentColor 6%,transparent);
  --tk-bg-inset: rgba(0, 0, 0, 0.04);
  --tk-bg-inset:color-mix(in srgb,currentColor 4%,transparent);
  --tk-bg-code: rgba(0, 0, 0, 0.04);
  --tk-bg-code:color-mix(in srgb,currentColor 4%,transparent);

  /* —— 纸的层次：统一柔影（替代散落硬阴影）—— */
  --tk-shadow-paper: 0 1px 2px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.05);
  --tk-shadow-paper:0 1px 2px color-mix(in srgb,currentColor 8%,transparent),
                    0 6px 16px color-mix(in srgb,currentColor 5%,transparent);
  --tk-shadow-lift: 0 2px 4px rgba(0, 0, 0, 0.10), 0 12px 28px rgba(0, 0, 0, 0.08);
  --tk-shadow-lift:0 2px 4px color-mix(in srgb,currentColor 10%,transparent),
                   0 12px 28px color-mix(in srgb,currentColor 8%,transparent);

  /* —— 统一圆角与字号 —— */
  --tk-r-card:12px; --tk-r-input:8px; --tk-r-pill:999px;
  --tk-fs-base:14px; --tk-lh:1.7;

  /* —— 补齐此前未定义的变量（修复 TkAvatar:59 / TkComment:329）—— */
  --tk-dislike-color:#B0524F;
  --tk-avatar-border: rgba(0, 0, 0, 0.14);
  --tk-avatar-border:color-mix(in srgb,currentColor 14%,transparent);

  /* —— 向后兼容别名（未在本计划触及的组件仍引用这些旧名）—— */
  --tk-text-secondary:var(--tk-text-2);
  --tk-text-tertiary:var(--tk-text-3);
  --tk-border-strong: rgba(0, 0, 0, 0.25);
  --tk-border-strong:color-mix(in srgb,currentColor 25%,transparent);

  /* =========================================================
   *  对齐 comment-section-ui 设计稿：设计 token 落库
   *  - 暗色系（data-theme="dark"）使用 colors_and_type.css 暗色值
   *  - 亮色系（data-theme="light"）走极简柔和值
   *  - 这些值用于卡片背景、提交单容器、pill 标签、3 个元信息等
   * ========================================================= */
  --tk-bg-page:transparent;
  --tk-bg-card: rgba(0, 0, 0, 0.04);
  --tk-bg-card:color-mix(in srgb,currentColor 4%,transparent);
  --tk-bg-elevated: rgba(0, 0, 0, 0.07);
  --tk-bg-elevated:color-mix(in srgb,currentColor 7%,transparent);
  --tk-bg-input: rgba(0, 0, 0, 0.05);
  --tk-bg-input:color-mix(in srgb,currentColor 5%,transparent);
  --tk-bg-hover: rgba(0, 0, 0, 0.08);
  --tk-bg-hover:color-mix(in srgb,currentColor 8%,transparent);
  --tk-bg-overlay: rgba(0, 0, 0, 0.60);
  --tk-bg-overlay:color-mix(in srgb,#000 60%,transparent);
  --tk-border-light: rgba(0, 0, 0, 0.16);
  --tk-border-light:color-mix(in srgb,currentColor 16%,transparent);
  --tk-shadow-card:0 1px 2px rgba(0,0,0,0.04);
  --tk-shadow-float: 0 4px 16px rgba(0, 0, 0, 0.12);
  --tk-shadow-float:color-mix(in srgb,#000 12%,transparent);
  --tk-r-sm:4px;
  --tk-avatar-sm:32px;
  --tk-avatar-md:40px;
  --tk-avatar-lg:48px;
  --tk-space-xs:4px;
  --tk-space-sm:8px;
  --tk-space-md:12px;
  --tk-space-lg:16px;
  --tk-space-xl:20px;
  --tk-space-2xl:24px;
  --tk-space-3xl:32px;
  /* 品牌色发光环：用于输入框聚焦外发光（设计稿 164 行） */
  --tk-brand-glow: rgba(94, 140, 106, 0.15);
  --tk-brand-glow:color-mix(in srgb,var(--tk-brand) 15%,transparent);

  color:inherit; font-size:var(--tk-fs-base); line-height:var(--tk-lh);
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
}

/* 主题变量：由 JS checkTheme() 驱动 data-theme 属性，单一来源 */
.tk-root[data-theme="light"]{
  --tk-bg-popup:#fff;
  --tk-shadow:0 6px 16px rgba(0,0,0,0.06);
  /* 设计稿亮色降饱和补色 */
  --tk-bg-card:#ffffff;
  --tk-bg-elevated:#fafafa;
  --tk-bg-input:#ffffff;
  --tk-bg-hover:#f3f4f6;
  --tk-border:#e5e7eb;
  --tk-border-light:#e5e7eb;
}
.tk-root[data-theme="dark"]{
  /* 旧版浏览器暗色降饱和补色降级 */
  --tk-brand-light: rgba(94, 140, 106, 0.12);
  --tk-brand-light:color-mix(in srgb,var(--tk-brand) 12%,transparent);
  --tk-brand-ring: rgba(94, 140, 106, 0.38);
  --tk-brand-ring: color-mix(in srgb,var(--tk-brand) 38%,transparent);
  --tk-info: rgba(255, 255, 255, 0.55);
  --tk-info:color-mix(in srgb,currentColor 55%,transparent);
  --tk-text-2: rgba(255, 255, 255, 0.62);
  --tk-text-2:color-mix(in srgb,currentColor 62%,transparent);
  --tk-text-3: rgba(255, 255, 255, 0.42);
  --tk-text-3:color-mix(in srgb,currentColor 42%,transparent);
  --tk-border: rgba(255, 255, 255, 0.12);
  --tk-border:color-mix(in srgb,currentColor 12%,transparent);
  --tk-border-soft: rgba(255, 255, 255, 0.07);
  --tk-border-soft:color-mix(in srgb,currentColor 7%,transparent);
  --tk-bg-subtle: rgba(255, 255, 255, 0.03);
  --tk-bg-subtle:color-mix(in srgb,currentColor 3%,transparent);
  --tk-bg-muted: rgba(255, 255, 255, 0.06);
  --tk-bg-muted:color-mix(in srgb,currentColor 6%,transparent);
  --tk-bg-inset: rgba(255, 255, 255, 0.04);
  --tk-bg-inset:color-mix(in srgb,currentColor 4%,transparent);
  --tk-bg-code: rgba(255, 255, 255, 0.04);
  --tk-bg-code:color-mix(in srgb,currentColor 4%,transparent);
  --tk-avatar-border: rgba(255, 255, 255, 0.14);
  --tk-avatar-border:color-mix(in srgb,currentColor 14%,transparent);
  --tk-border-strong: rgba(255, 255, 255, 0.25);
  --tk-border-strong:color-mix(in srgb,currentColor 25%,transparent);
  --tk-bg-card: rgba(255, 255, 255, 0.04);
  --tk-bg-card:color-mix(in srgb,currentColor 4%,transparent);
  --tk-bg-elevated: rgba(255, 255, 255, 0.07);
  --tk-bg-elevated:color-mix(in srgb,currentColor 7%,transparent);
  --tk-bg-input: rgba(255, 255, 255, 0.05);
  --tk-bg-input:color-mix(in srgb,currentColor 5%,transparent);
  --tk-bg-hover: rgba(255, 255, 255, 0.08);
  --tk-bg-hover:color-mix(in srgb,currentColor 8%,transparent);
  --tk-bg-overlay: rgba(0, 0, 0, 0.60);
  --tk-bg-overlay:color-mix(in srgb,#000 60%,transparent);
  --tk-border-light: rgba(255, 255, 255, 0.16);
  --tk-border-light:color-mix(in srgb,currentColor 16%,transparent);
  --tk-shadow-float: 0 4px 16px rgba(0, 0, 0, 0.12);
  --tk-shadow-float:color-mix(in srgb,#000 12%,transparent);
  --tk-brand-glow: rgba(94, 140, 106, 0.15);
  --tk-brand-glow:color-mix(in srgb,var(--tk-brand) 15%,transparent);
  --tk-shadow-paper: 0 1px 2px rgba(255, 255, 255, 0.08), 0 6px 16px rgba(255, 255, 255, 0.05);
  --tk-shadow-paper:0 1px 2px color-mix(in srgb,currentColor 8%,transparent),
                    0 6px 16px color-mix(in srgb,currentColor 5%,transparent);
  --tk-shadow-lift: 0 2px 4px rgba(255, 255, 255, 0.1), 0 12px 28px rgba(255, 255, 255, 0.08);
  --tk-shadow-lift:0 2px 4px color-mix(in srgb,currentColor 10%,transparent),
                   0 12px 28px color-mix(in srgb,currentColor 8%,transparent);

  --tk-bg-popup:#1e1e1e;
  --tk-shadow:0 6px 16px rgba(0,0,0,0.35);
  --tk-shadow-lift:0 2px 4px rgba(0,0,0,.4),0 12px 28px rgba(0,0,0,0.32);
  /* 设计稿 colors_and_type.css 暗色值 */
  --tk-bg-page:#0d0d0d;
  --tk-bg-card:#1a1a1a;
  --tk-bg-elevated:#1f1f1f;
  --tk-bg-input:#1f1f1f;
  --tk-bg-hover:#262626;
  --tk-bg-overlay:rgba(0,0,0,0.6);
  --tk-text-primary:#f5f5f5;
  --tk-text-secondary:#a3a3a3;
  --tk-text-tertiary:#737373;
  --tk-text-muted:#525252;
  --tk-border:#2a2a2a;
  --tk-border-light:#333333;
  --tk-separator:#262626;
  --tk-shadow-card:0 1px 2px rgba(0,0,0,0.04);
  --tk-shadow-float:0 4px 16px rgba(0,0,0,0.12);
  --tk-status-success:#22c55e;
  --tk-status-warning:#f59e0b;
  --tk-status-error:#ef4444;
  --tk-status-info:#3b82f6;
  --tk-badge-red:#ef4444;
  --tk-badge-red-bg:rgba(239,68,68,0.15);
}

.tk-root a { color: var(--tk-brand); text-decoration: none; }
.tk-root a:hover { color: var(--tk-brand-hover); }
.tk-root button { cursor: pointer; font-family: inherit; }
.tk-root pre { overflow-x: auto; padding: 12px; background: var(--tk-bg-code); border: 1px solid var(--tk-border-soft); border-radius: var(--tk-r-input); }
.tk-root code { font-family: 'SF Mono', Monaco, Consolas, monospace; }

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .tk-root *, .tk-root *::before, .tk-root *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
