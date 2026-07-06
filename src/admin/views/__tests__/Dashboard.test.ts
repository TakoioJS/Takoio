// @vitest-environment jsdom
/**
 * Dashboard 视图测试
 *
 * 覆盖：数据加载、统计卡片渲染、系统状态、最近评论
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ---------- mock 基础依赖 ----------
vi.mock('@shared/utils/i18n', () => ({ t: vi.fn((key: string) => key) }))
vi.mock('@shared/utils/marked', () => ({ renderMarkdown: vi.fn(async (t: string) => t) }))

// ---------- mock API ----------
const mockCommentsApi = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  list: vi.fn(),
}))
vi.mock('../../api/comments', () => ({ commentsApi: mockCommentsApi }))

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))
vi.mock('../../api/client', () => ({ api: mockApi }))

// ---------- mock Naive UI ----------
const mockMessage = vi.hoisted(() => ({
  success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(),
}))
vi.mock('naive-ui', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useMessage: () => mockMessage,
    useDialog: () => ({ warning: vi.fn((o: any) => o.onPositiveClick?.()) }),
  }
})

// ---------- mock Vue Router ----------
const mockRoute = vi.hoisted(() => ({ path: '/dashboard', query: {} }))
const mockRouter = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, useRoute: () => mockRoute, useRouter: () => mockRouter }
})

// ---------- mock auto-import globals ----------
const mockAppStore = { isDark: false, toggleDark: vi.fn() }
const mockAuth = { token: '', isAuthenticated: false, logout: vi.fn() }
;(globalThis as any).useAppStore = () => mockAppStore
;(globalThis as any).useAuthStore = () => mockAuth

import { mount } from '@vue/test-utils'
import Dashboard from '../../views/Dashboard.vue'

function createWrapper () {
  return mount(Dashboard, {
    global: {
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
        'n-button': { template: '<button><slot /></button>' },
        'n-icon': { template: '<i><slot /></i>' },
        'n-tag': { template: '<span><slot /></span>' },
        'n-spin': { template: '<div><slot /></div>' },
        'n-skeleton': { template: '<div class="n-skeleton" />' },
        SystemStatus: { template: '<div class="system-status-mock" />' },
        RecentComments: { template: '<div class="recent-comments-mock" />' },
      },
    },
  })
}

describe('Dashboard.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockCommentsApi.getDashboard.mockResolvedValue({
      total: 120, today: 3, yesterday: 5, pending: 2, spam: 1, hidden: 0, topCount: 0,
    })
    mockCommentsApi.list.mockResolvedValue({ data: [], total: 0 })
    mockApi.get.mockResolvedValue({ dev: false, dbType: 'sqlite', redisAvailable: true, summaryCount: 3 })
  })

  it('renders page title', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('欢迎回来')
  })

  it('loads stats on mount', async () => {
    createWrapper()
    await new Promise(process.nextTick) // wait for async load
    expect(mockCommentsApi.getDashboard).toHaveBeenCalled()
    expect(mockCommentsApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 6, filter: 'all' })
    expect(mockApi.get).toHaveBeenCalledWith('/api/admin/system')
  })

  it('renders system status component', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.system-status-mock').exists()).toBe(true)
  })

  it('renders recent comments component', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.recent-comments-mock').exists()).toBe(true)
  })

  it('handles load error gracefully', async () => {
    mockCommentsApi.getDashboard.mockRejectedValueOnce(new Error('API error'))
    createWrapper()
    await new Promise(process.nextTick)
    // Should not throw — error is caught and shown via message.error
    expect(mockMessage.error).toHaveBeenCalled()
  })
})
