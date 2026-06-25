<template>
  <div class="tk-admin">
    <!-- Setup mode: first-time password creation -->
    <div v-if="needSetup && !loggedIn" class="tk-admin-login">
      <el-card>
        <h3>{{ t('setup') }}</h3>
        <p class="tk-setup-desc">{{ t('setupDesc') }}</p>
        <el-input
          v-model="setupPassword"
          type="password"
          :placeholder="t('createPassword')"
          show-password
          @keydown.enter="onSetup"
        />
        <el-input
          v-model="setupPasswordConfirm"
          type="password"
          :placeholder="t('confirmPassword')"
          show-password
          class="tk-setup-confirm"
          @keydown.enter="onSetup"
        />
        <el-button
          type="primary"
          :loading="logging"
          @click="onSetup"
          class="tk-login-btn"
        >
          {{ t('createPassword') }}
        </el-button>
      </el-card>
    </div>

    <!-- Login mode: normal authentication -->
    <div v-else-if="!loggedIn" class="tk-admin-login">
      <el-card>
        <h3>{{ t('login') }}</h3>
        <el-input
          v-model="password"
          type="password"
          :placeholder="t('password')"
          show-password
          @keydown.enter="onLogin"
        />
        <el-checkbox v-model="rememberMe" class="tk-remember">
          {{ t('rememberMe') }}
        </el-checkbox>
        <el-button
          type="primary"
          :loading="logging"
          @click="onLogin"
          class="tk-login-btn"
        >
          {{ t('login') }}
        </el-button>
      </el-card>
    </div>

    <!-- Authenticated: admin panel -->
    <div v-else>
      <div class="tk-admin-top-tabs">
        <el-button link @click="$emit('back')" :icon="ArrowLeft" :title="t('goBack')" class="tk-action-icon" />
        <el-tabs v-model="activeTab" class="tk-main-tabs">
          <el-tab-pane :label="t('commentTab')" name="comment"></el-tab-pane>
          <el-tab-pane :label="t('config')" name="config"></el-tab-pane>
          <el-tab-pane :label="t('import') + '/' + t('export')" name="transfer"></el-tab-pane>
        </el-tabs>
        <div class="tk-admin-actions">
          <el-button link @click="showPasswordDialog = true" :icon="Key" :title="t('changePassword')" class="tk-action-icon" />
          <el-button link @click="onLogout" :icon="SwitchButton" :title="t('logout')" class="tk-action-icon" />
        </div>
      </div>

      <div class="tk-admin-content">
        <TkAdminComment v-if="activeTab === 'comment'" :options="options" :token="sessionToken" @expired="onSessionExpired" />
        <TkAdminConfig v-if="activeTab === 'config'" :options="options" :token="sessionToken" @expired="onSessionExpired" />
        <div v-if="activeTab === 'transfer'">
          <TkAdminImport :options="options" :token="sessionToken" />
          <TkAdminExport :options="options" :token="sessionToken" />
        </div>
      </div>

      <!-- 修改密码对话框 -->
      <el-dialog v-model="showPasswordDialog" :title="t('changePassword')" width="400px" destroy-on-close>
        <el-form :label-position="'top'" style="padding: 0 4px;">
          <el-form-item :label="t('oldPassword')">
            <el-input v-model="pwdOld" type="password" show-password />
          </el-form-item>
          <el-form-item :label="t('newPassword')">
            <el-input v-model="pwdNew" type="password" show-password />
          </el-form-item>
          <el-form-item :label="t('confirmPassword')">
            <el-input v-model="pwdConfirm" type="password" show-password @keydown.enter="onChangePassword" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showPasswordDialog = false">{{ t('cancel') }}</el-button>
          <el-button type="primary" :loading="changingPassword" @click="onChangePassword">{{ t('save') }}</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import {
  ElButton, ElInput, ElCard,
  ElTabs, ElTabPane, ElCheckbox, ElMessage,
  ElDialog, ElForm, ElFormItem
} from 'element-plus'
import { ArrowLeft, SwitchButton, Key } from '@element-plus/icons-vue'
import { t, request, adminRequest } from '../../utils'
import type { TakoioConfig } from '../../types'

const TkAdminComment = defineAsyncComponent(() => import('./TkAdminComment.vue'))
const TkAdminConfig  = defineAsyncComponent(() => import('./TkAdminConfig.vue'))
const TkAdminImport  = defineAsyncComponent(() => import('./TkAdminImport.vue'))
const TkAdminExport  = defineAsyncComponent(() => import('./TkAdminExport.vue'))

interface Props {
  options: TakoioConfig
}

const props = defineProps<Props>()
defineEmits<{ (e: 'back'): void }>()

const password = ref('')
const loggedIn = ref(false)
const logging = ref(false)
const rememberMe = ref(true)
const activeTab = ref('comment')
const sessionToken = ref('')
const needSetup = ref(false)
const setupPassword = ref('')
const setupPasswordConfirm = ref('')

const SESSION_KEY = 'takoio-admin-session'
const OLD_SESSION_KEY = 'twikoo-admin-session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 小时

// 检查已有会话 + 是否需要初始化设置
onMounted(async () => {
  // Try new key first, then old key for backward compatibility
  const checkSession = (key: string): boolean => {
    const saved = localStorage.getItem(key)
    if (!saved) return false
    try {
      const { token, expires } = JSON.parse(saved)
      if (Date.now() < expires) {
        sessionToken.value = token
        loggedIn.value = true
        return true
      } else {
        localStorage.removeItem(key)
      }
    } catch { /* ignore */ }
    return false
  }

  if (!checkSession(SESSION_KEY) && checkSession(OLD_SESSION_KEY)) {
    // Migrate old session to new key
    const saved = localStorage.getItem(OLD_SESSION_KEY)
    localStorage.removeItem(OLD_SESSION_KEY)
    if (saved) localStorage.setItem(SESSION_KEY, saved)
  }

  // 无有效会话时，检查是否需要首次设置
  try {
    const base = props.options.envId.replace(/\/$/, '')
    const result = await request(`${base}/api/admin/setup`)
    if ((result as any).needSetup) {
      needSetup.value = true
    }
  } catch { /* ignore */ }
})

const saveSession = (token: string): void => {
  sessionToken.value = token
  if (rememberMe.value) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      token,
      expires: Date.now() + SESSION_DURATION
    }))
  }
  startSessionRefresh()
}

// Auto-refresh session token every 30 minutes
const REFRESH_INTERVAL = 30 * 60 * 1000
let refreshTimer: ReturnType<typeof setInterval> | null = null

const refreshSession = async (): Promise<void> => {
  if (!sessionToken.value) return
  try {
    const base = props.options.envId.replace(/\/$/, '')
    const res = await request(`${base}/api/admin/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionToken.value}` }
    })
    if ((res as any).success && (res as any).token) {
      const newToken = (res as any).token
      sessionToken.value = newToken
      // Update localStorage if rememberMe is on
      if (rememberMe.value) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          token: newToken,
          expires: Date.now() + SESSION_DURATION
        }))
      }
    }
  } catch { /* silent — will retry next interval or on next admin action */ }
}

const startSessionRefresh = (): void => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(refreshSession, REFRESH_INTERVAL)
}

const stopSessionRefresh = (): void => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
}

const onSetup = async (): Promise<void> => {
  if (!setupPassword.value) {
    ElMessage.warning(t('password') + ' ' + t('required'))
    return
  }
  if (setupPassword.value.length < 8) {
    ElMessage.warning(t('password') + ': ' + '至少 8 位')
    return
  }
  if (setupPassword.value !== setupPasswordConfirm.value) {
    ElMessage.error(t('passwordMismatch'))
    return
  }

  logging.value = true
  try {
    const base = props.options.envId.replace(/\/$/, '')
    const result = await request(`${base}/api/admin/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: setupPassword.value })
    })
    if ((result as any).success) {
      const serverToken = (result as any).token || ''
      saveSession(serverToken)
      needSetup.value = false
      loggedIn.value = true
      setupPassword.value = ''
      setupPasswordConfirm.value = ''
      ElMessage.success(t('setupSuccess'))
      props.options.onLoginSuccess?.()
    } else {
      ElMessage.error((result as any).message || t('loginFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('loginFailed'))
  } finally {
    logging.value = false
  }
}

const onLogin = async (): Promise<void> => {
  if (!password.value) {
    ElMessage.warning(t('password') + ' ' + t('required'))
    return
  }
  logging.value = true
  try {
    const base = props.options.envId.replace(/\/$/, '')
    const result = await request(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    if ((result as any).success) {
      const serverToken = (result as any).token || ''
      saveSession(serverToken)
      loggedIn.value = true
      ElMessage.success(t('loginSuccess'))
      props.options.onLoginSuccess?.()
    } else if ((result as any).needSetup) {
      needSetup.value = true
    } else {
      ElMessage.error((result as any).message || t('loginFailed'))
    }
  } catch (e) {
    ElMessage.error(t('loginFailed'))
  } finally {
    logging.value = false
  }
}

const onLogout = async (): Promise<void> => {
  try {
    await adminRequest(props.options.envId, sessionToken.value, '/api/admin/logout', 'POST')
  } catch { /* ignore */ }
  loggedIn.value = false
  password.value = ''
  sessionToken.value = ''
  localStorage.removeItem(SESSION_KEY)
  stopSessionRefresh()
  ElMessage.success(t('logout'))
  props.options.onLogoutSuccess?.()
}

const onSessionExpired = (): void => {
  loggedIn.value = false
  password.value = ''
  sessionToken.value = ''
  localStorage.removeItem(SESSION_KEY)
  stopSessionRefresh()
  ElMessage.warning(t('sessionExpired'))
}

// ========== 修改密码 ==========
const showPasswordDialog = ref(false)
const pwdOld = ref('')
const pwdNew = ref('')
const pwdConfirm = ref('')
const changingPassword = ref(false)

const onChangePassword = async (): Promise<void> => {
  if (!pwdOld.value) {
    ElMessage.warning(t('oldPassword') + ' ' + t('required'))
    return
  }
  if (!pwdNew.value || pwdNew.value.length < 8) {
    ElMessage.warning(t('newPassword') + ': 至少 8 位')
    return
  }
  if (pwdNew.value !== pwdConfirm.value) {
    ElMessage.error(t('passwordMismatch'))
    return
  }

  changingPassword.value = true
  try {
    // 先验证旧密码
    const base = props.options.envId.replace(/\/$/, '')
    const loginResult = await request(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwdOld.value })
    })
    if (!(loginResult as any).success) {
      ElMessage.error(t('loginFailed'))
      return
    }

    // 设置新密码
    const setResult = await adminRequest(props.options.envId, sessionToken.value, '/api/admin/password', 'PUT', { password: pwdNew.value })
    if ((setResult as any).success) {
      // 更新 session token
      const newToken = (setResult as any).token || ''
      if (newToken) saveSession(newToken)
      showPasswordDialog.value = false
      pwdOld.value = ''
      pwdNew.value = ''
      pwdConfirm.value = ''
      ElMessage.success(t('changePasswordSuccess'))
    } else {
      ElMessage.error((setResult as any).message || t('submitFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('submitFailed'))
  } finally {
    changingPassword.value = false
  }
}

onUnmounted(() => { stopSessionRefresh() })
</script>

<style scoped>
.tk-admin { max-width: 1200px; margin: 0 auto; padding: 16px; }
.tk-admin-header { position: relative; }
.tk-admin-top-tabs {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: var(--tk-admin-bg, #fff);
  border-bottom: 1px solid var(--tk-admin-border);
}
.tk-action-icon {
  font-size: 18px;
  color: var(--tk-admin-text-secondary);
  border: none !important;
  background: transparent !important;
  margin: 0 4px;
}
.tk-action-icon:hover {
  color: var(--tk-admin-primary);
}
.tk-main-tabs {
  flex: 1;
  margin: 0 16px;
}
.tk-main-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
  border-bottom: none;
}
.tk-main-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.tk-admin-actions {
  display: flex;
  gap: 8px;
}
.tk-admin-actions .el-button, .tk-admin-back .el-button { margin: 0; font-size: 16px; }
.tk-admin-header :deep(.el-tabs__nav-wrap) {
  padding-left: 36px;
  padding-right: 70px;
}
.tk-admin-login { max-width: 400px; margin: 40px auto 0; }
.tk-login-btn { margin-top: 16px; width: 100%; }
.tk-remember { margin-top: 12px; }
.tk-setup-desc { font-size: 13px; opacity: 0.7; margin-bottom: 16px; }
.tk-setup-confirm { margin-top: 12px; }
.tk-admin-content { padding-top: 16px; }
</style>
