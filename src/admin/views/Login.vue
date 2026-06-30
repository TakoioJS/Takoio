<template>
  <div class="login-page">
    <div v-if="checking" class="login-container">
      <div class="login-card"></div>
    </div>

    <div v-else class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img :src="iconUrl" alt="Takoio" class="login-logo-img" />
          </div>
          <h1 class="login-title">Takoio</h1>
          <p class="login-subtitle">{{ needSetup ? t('setupDesc') : '评论系统管理后台' }}</p>
        </div>

        <template v-if="needSetup">
          <n-form @submit.prevent="onSetup">
            <n-form-item class="pwd-item">
              <n-input
                v-model:value="setupPassword"
                type="password"
                show-password-on="click"
                :placeholder="t('createPassword')"
                size="large"
                @keydown.enter="onSetup"
              />
            </n-form-item>
            <div v-if="passwordStrength.level > 0" class="pwd-strength" :style="{ '--strength-color': strengthColor }">
              <div class="pwd-strength-bars">
                <span v-for="i in 4" :key="i" class="pwd-strength-bar" :class="{ filled: i <= passwordStrength.level }"></span>
              </div>
              <span class="pwd-strength-label">{{ passwordStrength.label }}</span>
            </div>
            <n-form-item class="pwd-item">
              <n-input
                v-model:value="setupPasswordConfirm"
                type="password"
                show-password-on="click"
                :placeholder="t('confirmPassword')"
                size="large"
                :status="confirmMismatch ? 'error' : undefined"
                @keydown.enter="onSetup"
              />
            </n-form-item>
            <p v-if="confirmMismatch" class="login-pwd-error">{{ t('passwordMismatch') }}</p>
            <n-form-item label="CORS 域名">
              <n-input
                v-model:value="corsOrigins"
                :disabled="auth.setupDev"
                size="large"
              />
            </n-form-item>
            <p v-if="auth.setupDev" class="login-cors-hint">热开发环境下 CORS 默认开放，无需配置</p>
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
          <n-button
            quaternary
            circle
            title="GitHub"
            tag="a"
            href="https://github.com/TakoioJS/Takoio"
            target="_blank"
            rel="noopener"
          >
            <template #icon>
              <n-icon size="18"><LogoGithub /></n-icon>
            </template>
          </n-button>
          <n-button
            quaternary
            circle
            :title="appStore.isDark ? '切换浅色' : '切换深色'"
            @click="appStore.toggleDark"
          >
            <template #icon>
              <n-icon size="18">
                <SunnyOutline v-if="appStore.isDark" />
                <MoonOutline v-else />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NForm, NFormItem, NInput, NButton, NCheckbox, NIcon, useMessage,
} from 'naive-ui'
import { SunnyOutline, MoonOutline, LogoGithub } from '@vicons/ionicons5'
import CaptchaWidget from '@shared/view/components/submit/components/CaptchaWidget.vue'
import { configApi } from '../api/config'
import { t } from '@shared/utils/i18n'

const iconUrl = import.meta.env.BASE_URL + 'icon/icon_108x108.png'

const appStore = useAppStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const message = useMessage()

const password = ref('')
const setupPassword = ref('')
const setupPasswordConfirm = ref('')
const corsOrigins = ref('')

const passwordStrength = computed(() => {
  const pwd = setupPassword.value
  if (!pwd) return { level: 0, label: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  if (score > 4) score = 4
  if (score < 1) score = 1
  const labels = ['', t('pwdWeak'), t('pwdFair'), t('pwdStrong'), t('pwdVeryStrong')]
  return { level: score, label: labels[score] }
})

const strengthColor = computed(() => {
  const colors = ['', 'var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--accent)']
  return colors[passwordStrength.value.level]
})

const confirmMismatch = computed(() =>
  setupPasswordConfirm.value.length > 0 && setupPassword.value !== setupPasswordConfirm.value
)
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
      if (!auth.setupDev && corsOrigins.value.trim()) {
        try { await configApi.save({ CORS_ORIGINS: corsOrigins.value.trim() }) }
        catch { /* 非关键，忽略 */ }
      }
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
  width: 26px;
  height: 26px;
  border-radius: 6px;
  margin: 0 auto 12px;
  overflow: hidden;
}
.login-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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

.login-cors-hint {
  margin: -4px 0 12px;
  font-size: 12px;
  color: var(--ink-3);
  text-align: center;
}

/* 密码强度指示器 */
.pwd-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 2px 6px;
}
.pwd-strength-bars {
  display: flex;
  gap: 4px;
  flex: 1;
}
.pwd-strength-bar {
  height: 3px;
  flex: 1;
  border-radius: 2px;
  background: var(--edge-soft);
  transition: background 0.2s;
}
.pwd-strength-bar.filled {
  background: var(--strength-color);
}
.pwd-strength-label {
  font-size: 12px;
  color: var(--strength-color);
  white-space: nowrap;
}

/* 收紧密码框之间的间距 */
.login-card :deep(.pwd-item) {
  margin-bottom: 0;
}

.login-pwd-error {
  margin: -4px 2px 12px;
  font-size: 12px;
  color: var(--danger);
}

/* 禁用态下保留可见边框，避免输入框“没有框” */
.login-card :deep(.n-input.n-input--disabled .n-input__border) {
  border-color: var(--edge-soft);
}

.login-footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--edge-soft);
}
</style>
