/**
 * Admin 模块共享测试工具
 *
 * 提供所有 admin view 测试需要的 mock 基础设施：
 * - @takoio/common（t / setLanguage）
 * - @shared/utils/i18n（t）
 * - @shared/utils/marked（renderMarkdown）
 * - API client（api.get/post/put/patch/delete）
 * - Naive UI（useMessage / useDialog）
 * - Vue Router（useRoute / useRouter）
 *
 * 用法：
 * ```ts
 * import { createMockApi, mockMessage, mockDialog } from '../../__tests__/test-utils'
 * ```
 */

import { vi } from 'vitest'

// =================================================================
// @takoio/common mock
// =================================================================
export function mockTakoioCommon () {
  vi.mock('@takoio/common', () => ({
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  }))
}

// =================================================================
// @shared/utils/i18n mock
// =================================================================
export function mockSharedI18n () {
  vi.mock('@shared/utils/i18n', () => ({
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  }))
}

// =================================================================
// @shared/utils/marked mock
// =================================================================
export function mockSharedMarked () {
  vi.mock('@shared/utils/marked', () => ({
    renderMarkdown: vi.fn(async (text: string) => text || ''),
  }))
}

// =================================================================
// API client mock
// =================================================================
export function createMockApi () {
  const mocks = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  vi.mock('../../api/client', () => ({
    api: mocks,
    setUnauthorizedHandler: vi.fn(),
  }))
  return mocks
}

// =================================================================
// Naive UI message mock
// =================================================================
export function createMockMessage () {
  const message = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    destroyAll: vi.fn(),
  }
  vi.mock('naive-ui', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, any>
    return {
      ...actual,
      useMessage: () => message,
      useDialog: () => ({
        warning: vi.fn((opts: any) => {
          if (opts.onPositiveClick) opts.onPositiveClick()
        }),
        info: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      }),
    }
  })
  return message
}

// =================================================================
// Vue Router mock
// =================================================================
export function createMockRouter () {
  const route = {
    path: '/',
    query: {},
    params: {},
    fullPath: '/',
    hash: '',
    name: null,
    matched: [],
    redirectedFrom: undefined,
    meta: {},
  }
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    resolve: vi.fn((to: any) => ({ href: typeof to === 'string' ? to : to.path || '/' })),
    currentRoute: { value: route },
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }
  vi.mock('vue-router', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, any>
    return {
      ...actual,
      useRoute: () => route,
      useRouter: () => router,
    }
  })
  return { route, router }
}

// =================================================================
// Sentry / other globals mock (auto-import 的全局符号)
// =================================================================
export function stubAutoImports () {
  // unplugin-auto-import 把 useAuthStore/useAppStore 等 Pinia store 暴露为全局
  // 这些在组件测试中不直接需要，但在渲染组件时可能被引用
}
