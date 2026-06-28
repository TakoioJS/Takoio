<template>
  <div class="login-page">
    <div v-if="checking" class="login-container">
      <div class="login-card"></div>
    </div>

    <div v-else class="login-container">
      <div class="login-card">
        <div class="login-header">
          <LogoMark class="login-logo" />
          <h1 class="login-title">Takoio Admin</h1>
          <p class="login-subtitle">{{ needSetup ? t('setupDesc') : '评论系统管理后台' }}</p>
        </div>

        <template v-if="needSetup">
          <n-form @submit.prevent="onSetup">
            <n-form-item>
              <n-input
                v-model:value="setupPassword"
                type="password"
                show-password-on="click"
                :placeholder="t('createPassword')"
                size="large"
                @keydown.enter="onSetup"
              />
            </n-form-item>
            <n-form-item>
              <n-input
                v-model:value="setupPasswordConfirm"
                type="password"
                show-password-on="click"
                :placeholder="t('confirmPassword')"
                size="large"
                @keydown.enter="onSetup"
              />
            </n-form-item>
            <n-button
              type="primary"
              block
              size="large"
              :loading="loading"
              @click="onSetup"
            >
              {{ t('createPassword') }}
            </n-button>
          </n-form>
        </template>

        <template v-else>
          <n-form @submit.prevent="onLogin">
            <n-form-item>
              <n-input
                v-model:value="password"
                type="password"
                show-password-on="click"
                :placeholder="t('password')"
                size="large"
                @keydown.enter="onLogin"
              />
            </n-form-item>
            <CaptchaWidget
              v-if="enableCaptcha"
              :provider="captchaProvider"
              :site-key="captchaSiteKey"
              :captcha-type="captchaType"
              v-model:value="captchaToken"
              @error="captchaError = $event"
            />
            <div v-if="captchaError" class="login-captcha-error">
              {{ captchaError }}
            </div>
            <div class="login-options">
              <n-checkbox v-model:checked="rememberMe">
                {{ t('rememberMe') }}
              </n-checkbox>
            </div>
            <n-button
              type="primary"
              block
              size="large"
              :loading="loading"
              @click="onLogin"
            >
              {{ t('login') }}
            </n-button>
          </n-form>
        </template>

        <div class="login-footer">
          <n-button text size="small" @click="appStore.toggleDark">
            {{ appStore.isDark ? t('lightMode') : t('darkMode') }}
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NForm, NFormItem, NInput, NButton, NCheckbox, useMessage,
} from 'naive-ui'
import CaptchaWidget from '@shared/view/components/submit/components/CaptchaWidget.vue'
import LogoMark from '../components/LogoMark.vue'
import { t } from '@shared/utils/i18n'

const appStore = useAppStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const message = useMessage()

const password = ref('')
const setupPassword = ref('')
const setupPasswordConfirm = ref('')
const rememberMe = ref(false)
const loading = ref(false)
const checking = ref(true)
const needSetup = ref(false)
const enableCaptcha = ref(false)
const captchaProvider = ref('')
const captchaSiteKey = ref('')
const captchaType = ref('')
const captchaToken = ref('')
const captchaError = ref('')

onMounted(async () => {
  if (!auth.isAuthenticated) {
    needSetup.value = await auth.checkSetup()
  }
  checking.value = false
})

const redirectTo = () => {
  const redirect = (route.query.redirect as string) || '/dashboard'
  router.replace(redirect)
}

const onSetup = async () => {
  if (!setupPassword.value) { message.warning(t('enterPassword')); return }
  if (setupPassword.value.length < 8) { message.warning(t('passwordTooShort')); return }
  if (setupPassword.value !== setupPasswordConfirm.value) { message.error(t('passwordMismatch')); return }
  loading.value = true
  try {
    const result = await auth.setup(setupPassword.value)
    if (result.success) {
      message.success(t('setupSuccess'))
      redirectTo()
    } else {
      message.error(result.message || t('setupFailed'))
    }
  } finally {
    loading.value = false
  }
}

const onLogin = async () => {
  if (!password.value) { message.warning(t('enterPassword')); return }
  if (enableCaptcha.value && !captchaToken.value) {
    message.warning(t('captchaRequired'))
    return
  }
  loading.value = true
  try {
    const result = await auth.login(password.value, rememberMe.value, captchaToken.value)
    if (result.success) {
      message.success(t('loginSuccess'))
      redirectTo()
    } else if (result.message === 'needSetup') {
      needSetup.value = true
    } else {
      message.error(result.message || t('loginFailed'))
    }
  } finally {
    loading.value = false
  }
}
</script>
<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--desk);
}

.login-container {
  width: 100%;
  max-width: 360px;
  padding: 24px;
}

.login-card {
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: var(--r-card);
  padding: 32px 28px 20px;
  box-shadow: var(--shadow-lift);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}
.login-logo {
  display: block;
  width: 28px;
  height: 28px;
  margin: 0 auto 12px;
  color: var(--accent);
}
.login-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
  font-family: var(--font-display);
}
.login-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ink-3);
}

.login-options {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.login-captcha-error {
  color: var(--danger);
  font-size: 13px;
  margin: 8px 0;
}

.login-footer {
  margin-top: 16px;
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid var(--edge-soft);
}
</style>
