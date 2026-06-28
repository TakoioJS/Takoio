import { defineStore } from 'pinia'

const DARK_KEY = 'takoio-admin-dark'
const SIDEBAR_KEY = 'takoio-admin-sidebar'

export const useAppStore = defineStore('app', {
  state: () => ({
    isDark: false,
    sidebarCollapsed: false,
  }),

  actions: {
    initTheme() {
      try {
        const saved = localStorage.getItem(DARK_KEY)
        if (saved === '1' || (saved == null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          this.isDark = true
          document.documentElement.classList.add('dark')
        }
        const sidebar = localStorage.getItem(SIDEBAR_KEY)
        this.sidebarCollapsed = sidebar === '1'
      } catch { /* ignore */ }
    },

    toggleDark() {
      this.isDark = !this.isDark
      try {
        localStorage.setItem(DARK_KEY, this.isDark ? '1' : '0')
      } catch { /* ignore */ }
      document.documentElement.classList.toggle('dark', this.isDark)
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      try {
        localStorage.setItem(SIDEBAR_KEY, this.sidebarCollapsed ? '1' : '0')
      } catch { /* ignore */ }
    },
  },
})
