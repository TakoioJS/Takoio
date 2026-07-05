import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '概览', icon: 'grid-outline' },
      },
      {
        path: 'comments',
        name: 'comments',
        component: () => import('../views/comments/List.vue'),
        meta: { title: '评论', icon: 'chatbubbles-outline' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('../views/users/List.vue'),
        meta: { title: '用户', icon: 'people-outline' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('../views/settings/Settings.vue'),
        meta: { title: '配置', icon: 'settings-outline' },
      },
      {
        path: 'ai',
        name: 'ai',
        component: () => import('../views/ai/Ai.vue'),
        meta: { title: 'AI 配置', icon: 'cube-outline' },
      },
      {
        path: 'ai/summary',
        name: 'ai-summary',
        component: () => import('../views/ai/Summary.vue'),
        meta: { title: '文章摘要管理', icon: 'document-text-outline' },
      },
      {
        path: 'data',
        name: 'data',
        component: () => import('../views/data/Data.vue'),
        meta: { title: '数据', icon: 'server-outline' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  // Always try to restore session from localStorage before checking auth.
  // This prevents race conditions where Pinia state is reset (e.g. HMR, memory pressure)
  // but the session is still valid in localStorage — which would cause a redirect to /login.
  if (!auth.isAuthenticated) {
    auth.restoreSession()
  }
  if (!to.meta.public && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    return { path: '/dashboard' }
  }
})

export default router
