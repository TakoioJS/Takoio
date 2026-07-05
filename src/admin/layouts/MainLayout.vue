<template>
  <div class="admin-layout">
    <!-- 顶部统一导航栏 -->
    <header class="admin-header">
      <div class="header-container">
        <!-- 左侧 Brand & Mobile Menu Button -->
        <div class="header-left">
          <n-button
            quaternary
            circle
            class="menu-toggle-btn"
            @click="drawerOpen = true"
          >
            <template #icon>
              <n-icon size="20">
                <MenuOutline />
              </n-icon>
            </template>
          </n-button>
          <div class="brand-section">
            <div class="brand-logo">
              <img :src="iconUrl" alt="Takoio" class="brand-img">
            </div>
            <span class="brand-text">Takoio</span>
          </div>
        </div>

        <!-- 中间 导航栏（桌面端） -->
        <nav class="header-nav">
          <template v-for="item in menuItems" :key="item.path">
            <div v-if="item.children" class="nav-item-group" :class="{ active: route.path.startsWith(item.path) }">
              <button class="nav-item nav-item-main" @click="toggleAiMenu">
                <n-icon size="16"><component :is="item.icon" /></n-icon>
                <span class="nav-label">{{ item.title }}</span>
                <n-icon size="12" class="nav-arrow" :class="{ rotated: aiMenuOpen }"><ChevronDownOutline /></n-icon>
              </button>
              <transition name="submenu">
                <div v-show="aiMenuOpen" class="nav-submenu">
                  <router-link v-for="child in item.children" :key="child.path" :to="child.path" class="nav-item nav-sub-item" :class="{ active: route.path === child.path }" @click="aiMenuOpen = false">
                    <span class="nav-label">{{ child.title }}</span>
                  </router-link>
                </div>
              </transition>
            </div>
            <router-link v-else :to="item.path" class="nav-item" :class="{ active: route.path.startsWith(item.path) }">
              <n-icon size="16"><component :is="item.icon" /></n-icon>
              <span class="nav-label">{{ item.title }}</span>
            </router-link>
          </template>
        </nav>

        <!-- 右侧 操作按钮 -->
        <div class="header-actions">
          <n-button quaternary circle title="GitHub" tag="a" href="https://github.com/TakoioJS/Takoio" target="_blank" rel="noopener">
            <template #icon><n-icon size="18"><LogoGithub /></n-icon></template>
          </n-button>
          <n-button quaternary circle :title="appStore.isDark ? '切换浅色' : '切换深色'" @click="appStore.toggleDark">
            <template #icon><n-icon size="18"><SunnyOutline v-if="appStore.isDark" /><MoonOutline v-else /></n-icon></template>
          </n-button>
          <n-button quaternary circle title="修改密码" @click="showPasswordDialog = true">
            <template #icon><n-icon size="18"><KeyOutline /></n-icon></template>
          </n-button>
          <n-button quaternary circle title="退出登录" @click="onLogout">
            <template #icon><n-icon size="18"><LogOutOutline /></n-icon></template>
          </n-button>
        </div>
      </div>
    </header>

    <!-- 移动端侧边导航抽屉 -->
    <n-drawer v-model:show="drawerOpen" :width="280" placement="left">
      <n-drawer-content closable>
        <template #header>
          <div class="brand-section">
            <div class="brand-logo">
              <img :src="iconUrl" alt="Takoio" class="brand-img">
            </div>
            <span class="brand-text">Takoio</span>
          </div>
        </template>
        <nav class="drawer-nav">
          <template v-for="item in menuItems" :key="item.path">
            <div v-if="item.children" class="drawer-nav-group" :class="{ active: route.path.startsWith(item.path) }">
              <button class="drawer-nav-item drawer-nav-item-main" @click="toggleAiMenu">
                <span class="drawer-nav-item-left">
                  <n-icon size="18"><component :is="item.icon" /></n-icon>
                  <span class="nav-label">{{ item.title }}</span>
                </span>
                <n-icon size="12" class="nav-arrow" :class="{ rotated: aiMenuOpen }"><ChevronDownOutline /></n-icon>
              </button>
              <transition name="submenu-slide">
                <div v-show="aiMenuOpen" class="drawer-nav-submenu">
                  <router-link v-for="child in item.children" :key="child.path" :to="child.path" class="drawer-nav-item drawer-nav-sub-item" :class="{ active: route.path === child.path }" @click="drawerOpen = false">
                    <span class="nav-label">{{ child.title }}</span>
                  </router-link>
                </div>
              </transition>
            </div>
            <router-link v-else :to="item.path" class="drawer-nav-item" :class="{ active: route.path.startsWith(item.path) }" @click="drawerOpen = false">
              <n-icon size="18"><component :is="item.icon" /></n-icon>
              <span class="nav-label">{{ item.title }}</span>
            </router-link>
          </template>
        </nav>
      </n-drawer-content>
    </n-drawer>

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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NIcon, NButton, NModal, NForm, NFormItem, NInput,
  NDrawer, NDrawerContent,
  useMessage, useDialog,
} from 'naive-ui'
import {
  GridOutline, ChatbubblesOutline, SettingsOutline, ServerOutline,
  SunnyOutline, MoonOutline, LogOutOutline, KeyOutline, CubeOutline,
  ChevronDownOutline, LogoGithub, PeopleOutline,
  MenuOutline,
} from '@vicons/ionicons5'
import { setUnauthorizedHandler } from '../api/client'
import { t } from '@shared/utils/i18n'

const iconUrl = import.meta.env.BASE_URL + 'icon/icon_108x108.png'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

const aiMenuOpen = ref(route.path.startsWith('/ai'))
const drawerOpen = ref(false)

const toggleAiMenu = () => { aiMenuOpen.value = !aiMenuOpen.value }

// 点击外部关闭 AI 子菜单（桌面端）
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.nav-item-group')) {
    aiMenuOpen.value = false
  }
}

onMounted(() => { document.addEventListener('click', handleClickOutside) })
onUnmounted(() => { document.removeEventListener('click', handleClickOutside) })

setUnauthorizedHandler(() => { router.push('/login') })

const menuItems = [
  { path: '/dashboard', title: '概览', icon: GridOutline },
  { path: '/comments', title: '评论', icon: ChatbubblesOutline },
  { path: '/users', title: '用户', icon: PeopleOutline },
  { path: '/settings', title: '配置', icon: SettingsOutline },
  {
    path: '/ai', title: 'AI 功能', icon: CubeOutline,
    children: [
      { path: '/ai', title: 'AI 配置' },
      { path: '/ai/summary', title: '文章摘要管理' },
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
    title: '确认退出', content: '确定要退出登录吗？', positiveText: '退出', negativeText: '取消',
    onPositiveClick: async () => { await auth.logout(); router.push('/login'); message.success(t('loggedOut')) },
  })
}

const onChangePassword = async () => {
  if (!pwdOld.value) { message.warning(t('enterOldPassword')); return }
  if (!pwdNew.value || pwdNew.value.length < 8) { message.warning(t('passwordMinLength8')); return }
  if (pwdNew.value !== pwdConfirm.value) { message.error(t('pwMismatch')); return }
  changingPassword.value = true
  try {
    const result = await auth.changePassword(pwdOld.value, pwdNew.value)
    if (result.success) { showPasswordDialog.value = false; message.success(t('changePasswordSuccess')) }
    else { message.error(result.message || t('operationFailed')) }
  } finally { changingPassword.value = false }
}
</script>

<style scoped>
.admin-layout {
  display: flex; flex-direction: column; min-height: 100vh; background: var(--desk);
}

/* ---- 顶部导航栏 ---- */
.admin-header {
  position: sticky; top: 0; z-index: 100; height: 56px;
  background: rgba(251,248,241,.85); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--edge-soft); box-sizing: border-box;
}
html.dark .admin-header { background: rgba(35,32,25,.85); }

.header-container {
  max-width: 1200px; margin: 0 auto; padding: 0 20px;
  height: 100%; display: flex; align-items: center;
  justify-content: space-between; gap: 20px;
}

/* 左侧 Brand + Hamburger */
.header-left { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.menu-toggle-btn { display: none; }

.brand-section { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.brand-logo {
  width: 26px; height: 26px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.brand-img { width: 100%; height: 100%; object-fit: contain; }
.brand-text { font-size: 16px; font-weight: 700; color: var(--ink); white-space: nowrap; }

/* 中间导航 */
.header-nav {
  display: flex; align-items: center; gap: 4px;
  flex: 1; overflow-x: clip; scrollbar-width: none;
}
.header-nav::-webkit-scrollbar { display: none; }
.nav-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: none; border-radius: 6px;
  color: var(--ink-2); text-decoration: none; font-size: 13px;
  font-weight: 500; background: none; cursor: pointer;
  font-family: inherit; white-space: nowrap;
  transition: all 0.2s cubic-bezier(.22,.61,.36,1);
}
.nav-item:hover { background: var(--edge-soft); color: var(--ink); }
.nav-item.active { background: var(--accent-soft); color: var(--accent); }
.nav-item-group { position: relative; display: flex; align-items: center; gap: 0; }
.nav-arrow { transition: transform 0.2s; }
.nav-arrow.rotated { transform: rotate(180deg); }
.nav-submenu {
  position: absolute; top: 100%; left: 0; min-width: 140px;
  background: var(--paper); border: 1px solid var(--edge-soft);
  border-radius: 8px; box-shadow: var(--shadow-lift);
  padding: 4px; display: flex; flex-direction: column; gap: 2px; z-index: 50;
}
.nav-sub-item { padding: 6px 12px; font-size: 13px; border-radius: 4px; }
.submenu-enter-active, .submenu-leave-active { transition: all 0.2s; }
.submenu-enter-from, .submenu-leave-to { opacity: 0; transform: translateY(-4px); }

/* 右侧操作区 */
.header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

/* ---- 主内容区 ---- */
.admin-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.admin-content {
  flex: 1; max-width: 1200px; width: 100%;
  margin: 0 auto; padding: 24px 20px 48px; box-sizing: border-box;
}
.page-fade-enter-active, .page-fade-leave-active { transition: opacity 0.2s; }
.page-fade-enter-from, .page-fade-leave-to { opacity: 0; }

/* ---- 移动端抽屉导航 ---- */
.drawer-nav { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; }
.drawer-nav-item {
  display: flex; align-items: center; justify-content: flex-start; gap: 10px;
  padding: 10px 16px; border: none; border-radius: 8px;
  color: var(--ink-2); text-decoration: none; font-size: 14px;
  font-weight: 500; background: none; cursor: pointer;
  font-family: inherit; width: 100%; text-align: left;
  box-sizing: border-box; transition: all 0.2s;
}
.drawer-nav-item-left { display: flex; align-items: center; gap: 10px; }
.drawer-nav-item:hover { background: var(--edge-soft); color: var(--ink); }
.drawer-nav-item.active { background: var(--accent-soft); color: var(--accent); }
.drawer-nav-group { display: flex; flex-direction: column; gap: 2px; }
.drawer-nav-item-main { justify-content: space-between; }
.drawer-nav-submenu { padding-left: 28px; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.drawer-nav-sub-item { padding: 8px 16px; font-size: 13px; border-radius: 6px; }
.submenu-slide-enter-active, .submenu-slide-leave-active {
  transition: max-height 0.25s ease-out, opacity 0.2s ease;
  max-height: 120px;
}
.submenu-slide-enter-from, .submenu-slide-leave-to { max-height: 0; opacity: 0; }

/* ============ 移动端适配 ============ */
@media (max-width: 768px) {
  .admin-header { height: 56px; padding: 0; }
  .header-container {
    padding: 0 16px; gap: 10px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .menu-toggle-btn { display: inline-flex; align-items: center; justify-content: center; }
  .header-nav { display: none; }
  .admin-content { padding: 16px 12px 32px; }
}
</style>