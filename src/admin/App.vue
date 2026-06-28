<template>
  <n-config-provider
    :theme="appStore.isDark ? darkTheme : null"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  NConfigProvider, NGlobalStyle, NMessageProvider, NDialogProvider, NNotificationProvider,
  darkTheme, zhCN, dateZhCN,
} from 'naive-ui'

const auth = useAuthStore()
const appStore = useAppStore()




const themeOverrides = computed(() => {
  const dark = appStore.isDark
  const ink = dark ? '#ECE6DA' : '#2B2825'
  const ink2 = dark ? '#B3AC9D' : '#57534B'
  const paper = dark ? '#232019' : '#FBF8F1'
  const paper2 = dark ? '#2A2620' : '#FCFAF4'
  const edge = dark ? '#38332B' : '#E6DFD0'
  const edgeSoft = dark ? '#2E2A23' : '#EFE9DD'
  const accent = dark ? '#8FB89A' : '#5E8C6A'
  const accentSoft = dark ? 'rgba(143,184,154,.14)' : '#E8F0EA'
  const warning = dark ? '#D6AC74' : '#B98A4B'
  const warningSoft = dark ? 'rgba(214,172,116,.14)' : '#F4EAD6'
  const danger = dark ? '#D48966' : '#B0524F'
  const dangerSoft = dark ? 'rgba(212,137,102,.14)' : '#F3E3E1'
  const shadowPaper = dark ? '0 1px 2px rgba(0,0,0,.30),0 6px 16px rgba(0,0,0,.25)' : '0 1px 2px rgba(43,40,37,.05),0 6px 16px rgba(43,40,37,.04)'
  const shadowLift = dark ? '0 2px 4px rgba(0,0,0,.35),0 12px 28px rgba(0,0,0,.30)' : '0 2px 4px rgba(43,40,37,.06),0 12px 28px rgba(43,40,37,.07)'

  return {
    common: {
      fontFamily: 'system-ui,"PingFang SC","Microsoft YaHei",sans-serif',
      fontFamilyDisplay: 'var(--font-display)',
      fontFamilyMono: '"SF Mono","JetBrains Mono",Consolas,monospace',
    },
    Card: {
      color: paper,
      colorModal: paper,
    },
    Menu: {
      itemColorHover: accentSoft,
    },
    Button: {
      colorPrimary: accent,
      textColorPrimary: '#fff',
      borderPrimary: `1px solid ${accent}`,
      colorHoverPrimary: accent,
      colorPressedPrimary: accent,
    },
    Input: {
      border: `1px solid ${edge}`,
      borderHover: `1px solid ${edge}`,
      borderFocus: `1px solid ${accent}`,
      boxShadowFocus: `0 0 0 2px ${accentSoft}`,
      color: paper2,
      colorDisabled: paper,
    },
    Tag: {
      color: accentSoft,
      textColor: accent,
      colorWarning: warningSoft,
      textColorWarning: warning,
      colorError: dangerSoft,
      textColorError: danger,
      borderRadius: '999px',
    },
    Message: {
      color: paper,
      iconColor: accent,
      boxShadow: shadowPaper,
      borderRadius: '12px',
    },
    Dialog: {
      color: paper,
      boxShadow: shadowLift,
      borderRadius: '12px',
    },
    Modal: {
      color: paper,
      boxShadow: shadowLift,
      borderRadius: '12px',
    },
    Notification: {
      color: paper,
      boxShadow: shadowLift,
      borderRadius: '12px',
    },
    DataTable: {
      color: paper,
      borderColor: edgeSoft,
      thColor: 'transparent',
      tdColor: paper,
      thTextColor: ink2,
      tdTextColor: ink,
    },
    DatePicker: {
      color: paper,
      borderColor: edge,
      borderFocus: accent,
    },
  }
})

onMounted(() => {
  appStore.initTheme()
  auth.restoreSession()
})
</script>

<style>
/* === 纸的纯净 · 全局 Token === */
:root{
  --desk:#F3EFE6; --paper:#FBF8F1; --paper-2:#FCFAF4;
  --edge:#E6DFD0; --edge-soft:#EFE9DD;
  --ink:#2B2825; --ink-2:#57534B; --ink-3:#8A8478;
  --accent:#5E8C6A; --accent-soft:#E8F0EA;
  --warning:#B98A4B; --warning-soft:#F4EAD6;
  --danger:#B0524F; --danger-soft:#F3E3E1;
  --shadow-paper:0 1px 2px rgba(43,40,37,.05),0 6px 16px rgba(43,40,37,.04);
  --shadow-lift:0 2px 4px rgba(43,40,37,.06),0 12px 28px rgba(43,40,37,.07);
  --r-card:12px; --r-input:8px;
  --font-display:"Noto Serif SC","Source Han Serif SC",Georgia,serif;
}
html.dark{
  --desk:#1A1815; --paper:#232019; --paper-2:#2A2620;
  --edge:#38332B; --edge-soft:#2E2A23;
  --ink:#ECE6DA; --ink-2:#B3AC9D; --ink-3:#807968;
  --accent:#8FB89A; --accent-soft:rgba(143,184,154,.14);
  --warning:#D6AC74; --warning-soft:rgba(214,172,116,.14);
  --danger:#D48966; --danger-soft:rgba(212,137,102,.14);
  --shadow-paper:0 1px 2px rgba(0,0,0,.30),0 8px 20px rgba(0,0,0,.25);
  --shadow-lift:0 2px 4px rgba(0,0,0,.35),0 12px 28px rgba(0,0,0,.30);
}

body{
  margin:0;
  font-family: system-ui,"PingFang SC","Microsoft YaHei",sans-serif;
  color: var(--ink);
  background: var(--desk);
  -webkit-font-smoothing: antialiased;
}

/* naive-ui 主题变量桥接 */
.n-config-provider{
  --n-text-color: var(--ink);
  --n-text-color-2: var(--ink-2);
  --n-text-color-3: var(--ink-3);
  --n-border-color: var(--edge);
  --n-border-color-strong: var(--edge);
  --n-divider-color: var(--edge-soft);
  --n-color: var(--paper);
  --n-color-strong: var(--paper-2);
  --n-color-modal: var(--paper);
  --n-color-popover: var(--paper);
  --n-input-color: var(--paper-2);
  --n-action-color: var(--paper-2);
  --n-card-color: var(--paper);
  --n-card-color-modal: var(--paper);
  --n-card-border: 1px solid var(--edge-soft);
  --n-card-border-radius: var(--r-card);
  --n-menu-item-color-hover: var(--accent-soft);
  --n-menu-item-color-active: var(--accent-soft);
  --n-menu-item-color-active-hover: var(--accent-soft);
  --n-menu-item-text-color-active: var(--accent);
  --n-input-color: var(--paper-2);
  --n-input-color-disabled: var(--paper);
  --n-tag-color: var(--accent-soft);
  --n-tag-text-color: var(--accent);
  --n-warning-color: var(--warning);
  --n-warning-color-hover: var(--warning);
  --n-warning-color-pressed: var(--warning);
  --n-error-color: var(--danger);
  --n-error-color-hover: var(--danger);
  --n-error-color-pressed: var(--danger);
  --n-success-color: var(--accent);
  --n-success-color-hover: var(--accent);
  --n-success-color-pressed: var(--accent);
}

html.dark .n-config-provider{
  --n-color: var(--paper);
  --n-color-strong: var(--paper-2);
  --n-color-modal: var(--paper);
  --n-color-popover: var(--paper);
  --n-input-color: rgba(255,255,255,.06);
  --n-action-color: rgba(255,255,255,.06);
  --n-card-color: var(--paper);
  --n-card-color-modal: var(--paper);
}

/* 全局排版 */
h1,h2,h3,.page-title,.section-title{
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.stat-value,.tabular-nums{
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
</style>
