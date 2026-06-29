<template>
  <div class="admin-layout">
    <!-- 顶部统一导航栏 -->
    <header class="admin-header">
      <div class="header-container">
        <!-- 左侧 Brand -->
        <div class="brand-section">
          <div class="brand-logo">
            <LogoMark />
          </div>
          <span class="brand-text">Takoio Admin</span>
        </div>

        <!-- 中间 导航栏 -->
        <nav class="header-nav">
          <template v-for="item in menuItems" :key="item.path">
            <!-- 有子菜单的项 -->
            <div v-if="item.children" class="nav-item-group" :class="{ active: route.path.startsWith(item.path) }">
              <button class="nav-item nav-item-main" @click="toggleAiMenu">
                <n-icon size="16"><component :is="item.icon" /></n-icon>
                <span class="nav-label">{{ item.title }}</span>
                <n-icon size="12" class="nav-arrow" :class="{ rotated: aiMenuOpen }">
                  <ChevronDownOutline />
                </n-icon>
              </button>
              <transition name="submenu">
                <div v-show="aiMenuOpen" class="nav-submenu">
                  <router-link
                    v-for="child in item.children"
                    :key="child.path"
                    :to="child.path"
                    class="nav-item nav-sub-item"
                    :class="{ active: route.path === child.path }"
                    @click="aiMenuOpen = false"
                  >
                    <span class="nav-label">{{ child.title }}</span>
                  </router-link>
                </div>
              </transition>
            </div>
            <!-- 普通项 -->
            <router-link
              v-else
              :to="item.path"
              class="nav-item"
              :class="{ active: route.path.startsWith(item.path) }"
            >
              <n-icon size="16">
                <component :is="item.icon" />
              </n-icon>
              <span class="nav-label">{{ item.title }}</span>
            </router-link>
          </template>
        </nav>

        <!-- 右侧 操作按钮 -->
        <div class="header-actions">
          <n-tag v-if="isDev" size="tiny" type="warning" round class="dev-badge">热开发环境</n-tag>
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
          <n-button
            quaternary
            circle
            title="修改密码"
            @click="showPasswordDialog = true"
          >
            <template #icon>
              <n-icon size="18"><KeyOutline /></n-icon>
            </template>
          </n-button>
          <n-button
            quaternary
            circle
            title="退出登录"
            @click="onLogout"
          >
            <template #icon>
              <n-icon size="18"><LogOutOutline /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="admin-main">
      <main class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 修改密码弹窗 -->
    <n-modal v-model:show="showPasswordDialog" preset="card" title="修改密码" style="max-width: 420px;">
      <n-form>
        <n-form-item label="旧密码">
          <n-input v-model:value="pwdOld" type="password" show-password-on="click" />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input v-model:value="pwdNew" type="password" show-password-on="click" placeholder="至少8位" />
        </n-form-item>
        <n-form-item label="确认新密码">
          <n-input v-model:value="pwdConfirm" type="password" show-password-on="click" @keydown.enter="onChangePassword" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <n-button @click="showPasswordDialog = false">取消</n-button>
          <n-button type="primary" :loading="changingPassword" @click="onChangePassword">保存</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NIcon, NButton, NModal, NForm, NFormItem, NInput, NTag,
  useMessage, useDialog,
} from 'naive-ui'
import {
  GridOutline, ChatbubblesOutline, SettingsOutline, ServerOutline,
  SunnyOutline, MoonOutline, LogOutOutline, KeyOutline, CubeOutline,
  ChevronDownOutline,
} from '@vicons/ionicons5'
import { setUnauthorizedHandler, api } from '../api/client'
import LogoMark from '../components/LogoMark.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const aiMenuOpen = ref(route.path.startsWith('/ai'))
const isDev = ref(false)

const toggleAiMenu = () => {
  aiMenuOpen.value = !aiMenuOpen.value
}

setUnauthorizedHandler(() => {
  router.push('/login')
})

const menuItems = [
  { path: '/dashboard', title: '概览', icon: GridOutline },
  { path: '/comments', title: '评论', icon: ChatbubblesOutline },
  { path: '/settings', title: '配置', icon: SettingsOutline },
  {
    path: '/ai', title: 'AI 功能', icon: CubeOutline,
    children: [
      { path: '/ai', title: 'AI 配置' },
      { path: '/ai/summary', title: '摘要管理' },
    ],
  },
  { path: '/data', title: '数据', icon: ServerOutline },
]

const showPasswordDialog = ref(false)
const pwdOld = ref('')
const pwdNew = ref('')
const pwdConfirm = ref('')
const changingPassword = ref(false)

const onLogout = () => {
  dialog.warning({
    title: '确认退出',
    content: '确定要退出登录吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      await auth.logout()
      router.push('/login')
      message.success('已退出登录')
    },
  })
}

const onChangePassword = async () => {
  if (!pwdOld.value) { message.warning('请输入旧密码'); return }
  if (!pwdNew.value || pwdNew.value.length < 8) { message.warning('新密码至少8位'); return }
  if (pwdNew.value !== pwdConfirm.value) { message.error('两次密码不一致'); return }
  changingPassword.value = true
  try {
    const result = await auth.changePassword(pwdOld.value, pwdNew.value)
    if (result.success) {
      showPasswordDialog.value = false
      message.success('密码修改成功')
    } else {
      message.error(result.message || '修改失败')
    }
  } finally {
    changingPassword.value = false
  }
}

onMounted(async () => {
  try {
    const r = await api.get('/api/admin/system')
    isDev.value = r.dev
  } catch { /* ignore — default to false */ }
})
</script>
<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--desk);
}

/* ---- 顶部导航栏 ---- */
.admin-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 56px;
  background: rgba(251,248,241,.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--edge-soft);
  box-sizing: border-box;
}
html.dark .admin-header {
  background: rgba(35,32,25,.85);
  border-bottom-color: var(--edge-soft);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

/* 左侧 Brand */
.brand-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.brand-logo {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--ink);
  color: var(--paper);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.brand-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
.dev-badge { margin-right: 2px; flex-shrink: 0; }

/* 中间导航 */
.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  overflow-x: clip;
  scrollbar-width: none;
}
.header-nav::-webkit-scrollbar {
  display: none;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  color: var(--ink-2);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  background: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(.22,.61,.36,1);
  white-space: nowrap;
}
.nav-item:hover {
  background: var(--edge-soft);
  color: var(--ink);
}
.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

/* AI 子菜单 */
.nav-item-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
}
.nav-arrow { transition: transform 0.2s; }
.nav-arrow.rotated { transform: rotate(180deg); }
.nav-submenu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 140px;
  background: var(--paper);
  border: 1px solid var(--edge-soft);
  border-radius: 8px;
  box-shadow: var(--shadow-lift);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
}
.nav-sub-item {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
}
.submenu-enter-active, .submenu-leave-active {
  transition: all 0.2s cubic-bezier(.22,.61,.36,1);
}
.submenu-enter-from, .submenu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 右侧操作区 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ---- 主内容区 ---- */
.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.admin-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 48px;
  box-sizing: border-box;
}

/* ---- 过渡动画 ---- */
.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(.22,.61,.36,1);
}
.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
}

/* ============ 移动端适配 ============ */
@media (max-width: 768px) {
  .admin-header {
    height: auto;
    padding: 8px 0;
  }
  .header-container {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "brand actions"
      "nav nav";
    padding: 0 16px;
    gap: 10px;
  }
  .brand-section {
    grid-area: brand;
  }
  .header-actions {
    grid-area: actions;
  }
  .header-nav {
    grid-area: nav;
    padding: 4px 0;
    margin-top: 4px;
    border-top: 1px solid var(--edge-soft);
  }
  .admin-content {
    padding: 16px 12px 32px;
  }
}
</style>
