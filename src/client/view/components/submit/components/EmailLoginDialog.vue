<template>
  <Teleport to="body">
    <Transition name="tk-fade">
      <div
        v-if="modelValue"
        class="tk-email-dialog-mask"
        role="dialog"
        aria-modal="true"
        @mousedown.self="onClose"
      >
        <div
          class="tk-email-dialog"
          @mousedown.stop
        >
          <div class="tk-email-dialog-header">
            <h3 class="tk-email-dialog-title">{{ t('emailLoginTitle') || '邮箱登录' }}</h3>
            <button
              type="button"
              class="tk-btn-icon-ghost"
              :aria-label="t('cancel') || '取消'"
              @click="onClose"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Step indicator -->
          <div class="tk-email-step-bar">
            <span :class="['tk-email-step', { 'tk-email-step-active': step === 1, 'tk-email-step-done': step > 1 }]">1</span>
            <span class="tk-email-step-line" />
            <span :class="['tk-email-step', { 'tk-email-step-active': step === 2, 'tk-email-step-done': step > 2 }]">2</span>
          </div>

          <div
            v-if="errorMsg"
            class="tk-email-error"
            role="alert"
          >
            {{ errorMsg }}
          </div>

          <!-- Step 1: Email + Name -->
          <div
            v-if="step === 1"
            class="tk-email-step-body"
          >
            <p class="tk-email-hint">{{ t('emailLoginHint') || '输入邮箱，我们会发送 6 位验证码' }}</p>
            <input
              v-model="form.email"
              type="email"
              class="tk-input"
              :placeholder="t('email') || '邮箱'"
              :aria-label="t('email') || '邮箱'"
              :disabled="sending"
              @keydown.enter="onSendCode"
            >
            <input
              v-model="form.name"
              type="text"
              class="tk-input"
              :placeholder="t('nickname') || '昵称（可选）'"
              :aria-label="t('nickname') || '昵称'"
              :disabled="sending"
              maxlength="50"
            >
            <button
              type="button"
              class="tk-btn-primary"
              :disabled="sending || !form.email"
              @click="onSendCode"
            >
              {{ sending ? (t('submitting') || '发送中…') : (t('sendCode') || '发送验证码') }}
            </button>
          </div>

          <!-- Step 2: Code verification -->
          <div
            v-if="step === 2"
            class="tk-email-step-body"
          >
            <p class="tk-email-hint">
              {{ (t('emailCodeSent') || '验证码已发送至 {email}').replace('{email}', form.email) }}
            </p>
            <input
              ref="codeInputRef"
              v-model="form.code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              class="tk-input tk-code-input"
              :placeholder="t('emailCodeRequired') || '请输入 6 位验证码'"
              :disabled="verifying"
              @keydown.enter="onVerify"
            >
            <button
              type="button"
              class="tk-btn-primary"
              :disabled="verifying || form.code.length !== 6"
              @click="onVerify"
            >
              {{ verifying ? (t('submitting') || '验证中…') : (t('login') || '登录') }}
            </button>
            <button
              type="button"
              class="tk-btn-link"
              :disabled="resendCountdown > 0 || sending"
              @click="onResend"
            >
              {{ resendCountdown > 0
                ? (t('emailCodeResend') || '重新发送 ({seconds}s)').replace('{seconds}', String(resendCountdown))
                : (t('emailCodeResend') || '重新发送').replace(/ \(\{seconds\}s\)$/, '') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t as _i18nT } from '@takoio/common'
import { setAuthState } from '../../../../utils/auth'

const t = (key: string) => _i18nT(key)

interface Props {
  modelValue: boolean
  envId: string
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
}>()

const step = ref<1 | 2>(1)
const form = reactive({ email: '', name: '', code: '' })
const sending = ref(false)
const verifying = ref(false)
const errorMsg = ref('')
const resendCountdown = ref(0)
const uuid = ref('')
const codeInputRef = ref<HTMLInputElement | null>(null)
let countdownTimer: number | null = null

function onClose () {
  if (sending.value || verifying.value) return
  emit('update:modelValue', false)
}

function startCountdown () {
  resendCountdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    resendCountdown.value -= 1
    if (resendCountdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function reset () {
  step.value = 1
  form.email = ''
  form.name = ''
  form.code = ''
  uuid.value = ''
  errorMsg.value = ''
  resendCountdown.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function onSendCode () {
  if (sending.value) return
  if (!form.email) {
    errorMsg.value = t('emailCodeRequired') || '请输入邮箱'
    return
  }
  errorMsg.value = ''
  sending.value = true
  try {
    const base = props.envId.replace(/\/$/, '') || window.location.origin
    const res = await fetch(`${base}/api/auth/email/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.email, name: form.name || undefined }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.statusMessage || data.message || `HTTP ${res.status}`)
    }
    const data = await res.json()
    uuid.value = data.uuid || ''
    step.value = 2
    startCountdown()
    await nextTick()
    codeInputRef.value?.focus()
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    sending.value = false
  }
}

async function onResend () {
  if (resendCountdown.value > 0 || sending.value) return
  await onSendCode()
}

async function onVerify () {
  if (verifying.value) return
  if (form.code.length !== 6) {
    errorMsg.value = t('emailCodeRequired') || '请输入 6 位验证码'
    return
  }
  errorMsg.value = ''
  verifying.value = true
  try {
    const base = props.envId.replace(/\/$/, '') || window.location.origin
    const res = await fetch(`${base}/api/auth/email/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uuid: uuid.value, code: form.code }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.statusMessage || data.message || `HTTP ${res.status}`)
    }
    const data = await res.json()
    if (!data.token || !data.user) throw new Error('Invalid response')
    setAuthState({ token: data.token, user: data.user })
    emit('success')
    emit('update:modelValue', false)
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    verifying.value = false
  }
}

// Esc 关闭
function onKeydown (e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) onClose()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  if (countdownTimer) clearInterval(countdownTimer)
})

// 打开时重置
watch(() => props.modelValue, (v) => { if (v) reset() })
</script>

<style scoped>
.tk-email-dialog-mask {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.tk-email-dialog {
  background: var(--tk-bg-elevated, #1a1a1a);
  border: 1px solid var(--tk-border, #2a2a2a);
  border-radius: var(--tk-r-card, 12px);
  box-shadow: var(--tk-shadow-float, 0 4px 16px rgba(0,0,0,0.4));
  padding: 24px;
  max-width: 400px;
  width: 100%;
  display: flex; flex-direction: column; gap: 16px;
}
.tk-email-dialog-header { display: flex; align-items: center; justify-content: space-between; }
.tk-email-dialog-title { font-size: 16px; font-weight: 600; margin: 0; }
.tk-email-step-bar { display: flex; align-items: center; justify-content: center; gap: 8px; }
.tk-email-step {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--tk-bg-hover, #262626); color: var(--tk-text-tertiary, #737373);
  font-size: 12px; font-weight: 500;
  transition: background .15s, color .15s;
}
.tk-email-step-active { background: var(--tk-brand, #fbbf24); color: #fff; }
.tk-email-step-done { background: var(--tk-success, #22c55e); color: #fff; }
.tk-email-step-line { width: 32px; height: 1px; background: var(--tk-border, #2a2a2a); }
.tk-email-hint { font-size: 13px; color: var(--tk-text-secondary, #a3a3a3); margin: 0; line-height: 1.5; }
.tk-email-step-body { display: flex; flex-direction: column; gap: 12px; }
.tk-email-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--tk-danger, #ef4444);
  padding: 8px 12px; border-radius: 8px; font-size: 13px;
}

.tk-fade-enter-active, .tk-fade-leave-active { transition: opacity .15s; }
.tk-fade-enter-from, .tk-fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .tk-email-dialog { padding: 16px; }
  .tk-email-dialog-mask { padding: 10px; }
}
</style>
