<template>
  <div
    ref="rootEl"
    class="tk-login-dropdown"
  >
    <button
      type="button"
      class="tk-login-trigger"
      :aria-expanded="open"
      :aria-haspopup="true"
      @click="open = !open"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line
        x1="15"
        y1="12"
        x2="3"
        y2="12"
      /></svg>
      <span>{{ t('login') || '登录' }}</span>
      <svg
        class="tk-chevron"
        :class="{ 'tk-chevron-open': open }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><polyline points="6 9 12 15 18 9" /></svg>
    </button>
    <Transition name="tk-fade">
      <div
        v-if="open"
        class="tk-login-menu"
        role="menu"
      >
        <button
          v-for="p in providers"
          :key="p"
          type="button"
          class="tk-login-menu-item"
          role="menuitem"
          @click="onSelect(p)"
        >
          <span
            class="tk-login-icon"
            :class="`tk-login-icon-${p}`"
            aria-hidden="true"
          >
            <svg
              v-if="p === 'github'"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            ><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.18c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.42-2.68 5.39-5.24 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" /></svg>
            <svg
              v-else-if="p === 'google'"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><circle
              cx="12"
              cy="12"
              r="10"
            /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            <svg
              v-else
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          </span>
          <span>{{ labelOf(p) }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { t as _i18nT } from '@takoio/common'
import { getLoginUrl } from '../../../../utils/auth'

type LoginProvider = 'github' | 'google' | 'email'

interface Props {
  providers: LoginProvider[]
  envId: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'select', provider: LoginProvider): void }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const t = (key: string) => _i18nT(key)

const labelOf = (p: LoginProvider) => {
  return p === 'github'
    ? (t('loginWithGitHub') || 'GitHub')
    : p === 'google'
      ? (t('loginWithGoogle') || 'Google')
      : (t('loginWithEmail') || '邮箱')
}

const onSelect = (p: LoginProvider) => {
  open.value = false
  emit('select', p)
  // 默认行为：跳转到 OAuth 授权（与现有 auth.ts:64 行为一致）
  if (props.envId && p !== 'email') {
    const url = getLoginUrl(props.envId, p)
    if (typeof window !== 'undefined') window.location.href = url
  }
  // 邮件登录：抛回 host 处理（由 useAuthState 监听或宿主接管）
}

const onDocumentClick = (e: MouseEvent) => {
  if (!rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))

// Esc 关闭
const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
onMounted(() => document.addEventListener('keydown', onEsc))
onBeforeUnmount(() => document.removeEventListener('keydown', onEsc))

// props.providers 变化时若为空，强制关闭
watch(() => props.providers, (v) => { if (v.length === 0) open.value = false })
</script>

<style scoped>
.tk-login-dropdown { position: relative; display: inline-flex; }
.tk-login-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: transparent; border: 1px solid var(--tk-border);
  border-radius: var(--tk-r-pill);
  color: inherit; font-size: 13px; font-weight: 500;
  cursor: pointer; font-family: inherit;
  transition: all .15s;
}
.tk-login-trigger:hover { background: var(--tk-bg-hover); border-color: var(--tk-border-strong); }
.tk-chevron { transition: transform .2s; }
.tk-chevron-open { transform: rotate(180deg); }
.tk-login-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  min-width: 160px;
  background: var(--tk-bg-elevated);
  border: 1px solid var(--tk-border);
  border-radius: var(--tk-r-input);
  box-shadow: var(--tk-shadow-float);
  padding: 4px;
  z-index: 50;
  display: flex; flex-direction: column;
}
.tk-login-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: transparent; border: none; border-radius: var(--tk-r-input);
  color: inherit; font-size: 13px; cursor: pointer; font-family: inherit;
  text-align: left; transition: background .12s;
}
.tk-login-menu-item:hover { background: var(--tk-bg-hover); }
.tk-login-icon { display: inline-flex; width: 16px; height: 16px; align-items: center; justify-content: center; color: var(--tk-text-secondary); }

.tk-fade-enter-active, .tk-fade-leave-active { transition: opacity .12s, transform .12s; }
.tk-fade-enter-from, .tk-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
