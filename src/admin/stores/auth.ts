import { defineStore } from 'pinia'

const SESSION_KEY = 'takoio-admin-session'
const OLD_SESSION_KEY = 'twikoo-admin-session'
const SESSION_DURATION = 24 * 60 * 60 * 1000

interface SessionData {
  token: string
  expires: number
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    isAuthenticated: false,
    needSetup: false,
    setupDev: false,
    _refreshTimer: null as ReturnType<typeof setInterval> | null,
  }),

  actions: {
    getBaseUrl(): string {
      return window.location.origin.replace(/\/$/, '')
    },

    restoreSession(): boolean {
      const check = (key: string): boolean => {
        const saved = localStorage.getItem(key)
        if (!saved) return false
        try {
          const { token, expires } = JSON.parse(saved) as SessionData
          if (Date.now() < expires) {
            this.token = token
            this.isAuthenticated = true
            return true
          } else {
            localStorage.removeItem(key)
          }
        } catch { /* ignore */ }
        return false
      }
      if (!check(SESSION_KEY) && check(OLD_SESSION_KEY)) {
        const saved = localStorage.getItem(OLD_SESSION_KEY)
        localStorage.removeItem(OLD_SESSION_KEY)
        if (saved) localStorage.setItem(SESSION_KEY, saved)
      }
      if (this.isAuthenticated) {
        this._startRefresh()
      }
      return this.isAuthenticated
    },

    _saveSession(newToken: string, remember = true) {
      this.token = newToken
      this.isAuthenticated = true
      if (remember) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          token: newToken,
          expires: Date.now() + SESSION_DURATION,
        }))
      }
      this._startRefresh()
    },

    async _refreshSession() {
      if (!this.token) return
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/admin/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.token) {
            this.token = data.token
            const saved = localStorage.getItem(SESSION_KEY)
            if (saved) {
              localStorage.setItem(SESSION_KEY, JSON.stringify({
                token: data.token,
                expires: Date.now() + SESSION_DURATION,
              }))
            }
          }
        }
      } catch { /* silent */ }
    },

    _startRefresh() {
      this._stopRefresh()
      this._refreshTimer = setInterval(() => this._refreshSession(), 30 * 60 * 1000)
    },

    _stopRefresh() {
      if (this._refreshTimer) {
        clearInterval(this._refreshTimer)
        this._refreshTimer = null
      }
    },

    async checkSetup(): Promise<boolean> {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/admin/setup`)
        const data = await res.json()
        this.needSetup = !!data.needSetup
        this.setupDev = !!data.dev
        return this.needSetup
      } catch {
        return false
      }
    },

    async login(password: string, remember = true, captchaToken?: string): Promise<{ success: boolean; message?: string }> {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, captchaToken }),
        })
        const data = await res.json()
        if (data.success) {
          this._saveSession(data.token || '', remember)
          return { success: true }
        } else if (data.needSetup) {
          this.needSetup = true
          return { success: false, message: 'needSetup' }
        }
        return { success: false, message: data.message || '登录失败' }
      } catch (e: any) {
        return { success: false, message: e?.message || '登录失败' }
      }
    },

    async setup(password: string): Promise<{ success: boolean; message?: string }> {
      try {
        const res = await fetch(`${this.getBaseUrl()}/api/admin/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
        const data = await res.json()
        if (data.success) {
          this._saveSession(data.token || '')
          this.needSetup = false
          return { success: true }
        }
        return { success: false, message: data.message || '设置失败' }
      } catch (e: any) {
        return { success: false, message: e?.message || '设置失败' }
      }
    },

    async logout() {
      try {
        await fetch(`${this.getBaseUrl()}/api/admin/logout`, {
          method: 'POST',
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        })
      } catch { /* ignore */ }
      this.isAuthenticated = false
      this.token = ''
      localStorage.removeItem(SESSION_KEY)
      this._stopRefresh()
    },

    async changePassword(oldPwd: string, newPwd: string): Promise<{ success: boolean; message?: string }> {
      try {
        const verifyRes = await fetch(`${this.getBaseUrl()}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: oldPwd }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyData.success) {
          return { success: false, message: '旧密码验证失败' }
        }
        const setRes = await fetch(`${this.getBaseUrl()}/api/admin/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ password: newPwd }),
        })
        const setData = await setRes.json()
        if (setData.success) {
          if (setData.token) this._saveSession(setData.token)
          return { success: true }
        }
        return { success: false, message: setData.message || '修改失败' }
      } catch (e: any) {
        return { success: false, message: e?.message || '修改失败' }
      }
    },
  },
})
