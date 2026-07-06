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
            <h3 class="tk-email-dialog-title">
              {{ t('emailLoginTitle') || '邮箱登录' }}
            </h3>
            <button
              type="button"
              class="tk-btn-icon-ghost"
              :aria-label="t('cancel') || '取消'"
              @click="onClose"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              /><line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              /></svg>
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
            <p class="tk-email-hint">
              {{ t('emailLoginHint') || '输入邮箱，我们会发送 6 位验证码' }}
            </p>
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
/* ========== 遮罩层：玻璃拟态 + 渐变暗化 ========== */
.tk-email-dialog-mask {
  position: fixed; inset: 0; z-index: 9999;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.4));
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: tk-mask-in .2s ease-out;
}
@keyframes tk-mask-in { from { opacity: 0; } to { opacity: 1; } }

/* ========== 弹窗：浅色玻璃面 + 顶部品牌渐变条 ========== */
.tk-email-dialog {
  position: relative;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow:
    0 20px 50px -12px rgba(0, 0, 0, 0.25),
    0 8px 24px -8px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 0;
  max-width: 420px;
  width: 100%;
  display: flex; flex-direction: column; gap: 0;
  overflow: hidden;
  animation: tk-dialog-in .25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tk-email-dialog::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #fbbf24 0%, #f97316 50%, #ef4444 100%);
  z-index: 1;
}
@keyframes tk-dialog-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ========== 头部 ========== */
.tk-email-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 0;
}
.tk-email-dialog-title {
  font-size: 17px; font-weight: 600;
  margin: 0;
  color: #1f2329;
  letter-spacing: -0.01em;
}
.tk-btn-icon-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border: none; background: transparent;
  color: #6b7280;
  border-radius: 8px;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.tk-btn-icon-ghost:hover { background: rgba(0, 0, 0, 0.05); color: #1f2329; }

/* ========== 步骤条 ========== */
.tk-email-step-bar {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 16px 20px 0;
}
.tk-email-step {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #f1f5f9; color: #94a3b8;
  font-size: 12px; font-weight: 600;
  transition: all .2s ease;
  border: 1.5px solid transparent;
}
.tk-email-step-active {
  background: #1f2329; color: #fff;
  box-shadow: 0 0 0 4px rgba(31, 35, 41, 0.08);
}
.tk-email-step-done {
  background: #10b981; color: #fff;
}
.tk-email-step-line {
  width: 36px; height: 1.5px; background: #e2e8f0;
}

/* ========== 提示 & 错误 ========== */
.tk-email-hint {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
  text-align: center;
}
.tk-email-error {
  margin: 0 20px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.04));
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #dc2626;
  padding: 8px 12px; border-radius: 8px; font-size: 13px;
  line-height: 1.4;
}

/* ========== 表单区 ========== */
.tk-email-step-body {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px 20px 20px;
}
.tk-input {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2329;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.tk-input::placeholder { color: #94a3b8; }
.tk-input:hover:not(:disabled) { border-color: #cbd5e1; }
.tk-input:focus {
  border-color: #fbbf24;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15);
}
.tk-input:disabled { opacity: 0.5; cursor: not-allowed; }
.tk-code-input {
  text-align: center;
  letter-spacing: 0.5em;
  font-size: 18px;
  font-weight: 600;
  font-family: 'SF Mono', Menlo, monospace;
}

/* ========== 主操作按钮 ========== */
.tk-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #1f2329 0%, #374151 100%);
  color: #fff;
  font-size: 14px; font-weight: 500;
  cursor: pointer;
  transition: transform .1s, box-shadow .15s, opacity .15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  margin-top: 4px;
}
.tk-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.tk-btn-primary:active:not(:disabled) { transform: translateY(0); }
.tk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* ========== 次要链接 ========== */
.tk-btn-link {
  display: inline-flex; align-items: center; justify-content: center;
  height: 32px;
  border: none; background: transparent;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  transition: color .15s;
  margin-top: -4px;
}
.tk-btn-link:hover:not(:disabled) { color: #1f2329; }
.tk-btn-link:disabled { color: #cbd5e1; cursor: not-allowed; }

/* ========== 过渡 ========== */
.tk-fade-enter-active, .tk-fade-leave-active { transition: opacity .15s; }
.tk-fade-enter-from, .tk-fade-leave-to { opacity: 0; }

/* ========== 暗色模式 ========== */
@media (prefers-color-scheme: dark) {
  .tk-email-dialog {
    background: rgba(22, 27, 34, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 20px 50px -12px rgba(0, 0, 0, 0.6),
      0 8px 24px -8px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .tk-email-dialog-title { color: #e5eaf3; }
  .tk-btn-icon-ghost { color: #9aa5b1; }
  .tk-btn-icon-ghost:hover { background: rgba(255, 255, 255, 0.05); color: #e5eaf3; }
  .tk-email-step { background: #161b22; color: #6b7280; }
  .tk-email-step-active { background: #fbbf24; color: #1f2329; box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.15); }
  .tk-email-step-line { background: #21262d; }
  .tk-email-hint { color: #9aa5b1; }
  .tk-input {
    background: #0d1117; border-color: #21262d; color: #e5eaf3;
  }
  .tk-input::placeholder { color: #6b7280; }
  .tk-input:hover:not(:disabled) { border-color: #30363d; }
  .tk-input:focus { border-color: #fbbf24; background: #161b22; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15); }
  .tk-btn-primary { background: linear-gradient(135deg, #fbbf24 0%, #f97316 100%); color: #1f2329; }
  .tk-btn-link { color: #9aa5b1; }
  .tk-btn-link:hover:not(:disabled) { color: #e5eaf3; }
}

/* ========== 移动端 ========== */
@media (max-width: 640px) {
  .tk-email-dialog-mask { padding: 12px; align-items: flex-end; }
  .tk-email-dialog {
    max-width: 100%;
    border-radius: 20px 20px 16px 16px;
    animation: tk-dialog-in-mobile .25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes tk-dialog-in-mobile {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .tk-email-dialog-header { padding: 18px 16px 0; }
  .tk-email-step-bar { padding: 12px 16px 0; }
  .tk-email-step-body { padding: 14px 16px 18px; }
  .tk-email-error { margin: 0 16px; }
}
</style>
