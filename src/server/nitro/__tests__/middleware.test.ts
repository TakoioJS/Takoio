/**
 * Middleware unit tests (Task 8.4.1)
 *
 * 测试 5 个 nitro middleware（00.security-headers / 01.admin-spa / 02.cors /
 * 03.rate-limit / 04.logger）。
 *
 * 隔离策略：
 * - middleware 通过 Nitro auto-import 使用 h3 函数（globals），所以把 mock 后的
 *   h3 函数挂到 globalThis 上模拟 auto-import 行为。
 * - middleware 通过 `#core` facade 引用业务函数，用 `vi.mock('#core', ...)` 替换。
 * - `defineMiddleware` 是 Nitro 全局 auto-import，提供 passthrough 实现。
 * - 由于 ESM 静态 import 会被 hoist 到顶部（先于 globalThis 赋值），middleware
 *   必须用 `await import()` 动态加载，确保 globals 已就绪。
 * - vi.mock 工厂被 hoist 到顶部，所以 mock 对象必须用 vi.hoisted() 创建。
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ---------- 用 vi.hoisted 创建 mock 对象（在 vi.mock 工厂被调用前可用） ----------
const { h3Mocks, coreMocks } = vi.hoisted(() => {
  const h3Mocks = {
    setResponseHeader: vi.fn(),
    getRequestURL: vi.fn(),
    getRequestHeader: vi.fn(),
    setResponseStatus: vi.fn(),
    getRequestIP: vi.fn(() => '127.0.0.1'),
    getQuery: vi.fn(() => ({})),
    sendStream: vi.fn(),
    createError: vi.fn((init: any) => new Error(init?.statusMessage || 'H3Error')),
    sendNoContent: vi.fn(),
    sendRedirect: vi.fn(),
  }
  const coreMocks = {
    isProd: vi.fn(() => false),
    isDev: vi.fn(() => false),
    isServerless: vi.fn(() => false),
    getConfig: vi.fn(async () => ({})),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    rateLimitStore: {
      checkRateLimit: vi.fn(async () => true),
    },
    getClientIp: vi.fn(async () => '127.0.0.1'),
    TAKOIO_THROTTLE_MS: 0,
  }
  return { h3Mocks, coreMocks }
})

vi.mock('h3', () => h3Mocks)
vi.mock('#core', () => coreMocks)

// node:fs mock：existsSync 默认返回 true，让 admin-spa 的 adminDistDir 在模块
// 加载时被赋值；个别测试用 vi.mocked(...).mockReturnValueOnce(false) 覆盖。
const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(
    () => '<html><script>console.log(1)</script><script src="a.js"></script></html>'
  ),
}))
vi.mock('node:fs', () => fsMocks)

// 取出 mocked h3 用于断言
import * as h3 from 'h3'
import * as fs from 'node:fs'

// ---------- 共享 mock event 工厂 ----------
function makeEvent (overrides: Record<string, any> = {}): any {
  const headers: Record<string, string> = {}
  return {
    method: 'GET',
    path: '/',
    node: {
      req: {
        headers,
        on: vi.fn(),
        socket: { remoteAddress: '127.0.0.1' },
      },
      res: {
        statusCode: 200,
        on: vi.fn(),
      },
    },
    context: {},
    ...overrides,
  }
}

// ---------- 加载 middleware（在 globals 就绪后动态 import） ----------
let securityHeaders: any
let adminSpa: any
let cors: any
let rateLimit: any
let loggerMiddleware: any

beforeAll(async () => {
  // 1. defineMiddleware global — passthrough，只返回 handler
  ;(globalThis as any).defineMiddleware = (fn: any) => fn

  // 2. 把 h3 mocks 挂到 globalThis（模拟 Nitro auto-import）
  Object.assign(globalThis, h3Mocks)

  // 3. 动态加载 middleware（确保以上 globals 已就绪）
  const [sec, spa, corsMod, rl, log] = await Promise.all([
    import('../middleware/00.security-headers'),
    import('../middleware/01.admin-spa'),
    import('../middleware/02.cors'),
    import('../middleware/03.rate-limit'),
    import('../middleware/04.logger'),
  ])
  securityHeaders = sec.default
  adminSpa = spa.default
  cors = corsMod.default
  rateLimit = rl.default
  loggerMiddleware = log.default
})

beforeEach(() => {
  vi.clearAllMocks()
})

// =================================================================
// 00.security-headers
// =================================================================
describe('00.security-headers middleware', () => {
  it('sets essential security headers on every response', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/' } as any)

    securityHeaders(event)

    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'X-Frame-Options', 'DENY')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'X-Content-Type-Options', 'nosniff')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    )
  })

  it('sets HSTS header only in production', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValue({ pathname: '/' } as any)

    // dev mode: no HSTS
    vi.mocked(coreMocks.isProd).mockReturnValueOnce(false)
    securityHeaders(event)
    const callsDev = vi.mocked(h3.setResponseHeader).mock.calls.filter(
      (c: any[]) => c[1] === 'Strict-Transport-Security'
    )
    expect(callsDev).toHaveLength(0)

    vi.clearAllMocks()

    // prod mode: HSTS set
    vi.mocked(coreMocks.isProd).mockReturnValueOnce(true)
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/' } as any)
    securityHeaders(event)
    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  })

  it('sets CSP with nonce for /admin paths and stores nonce in context', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/admin/dashboard' } as any)

    securityHeaders(event)

    // nonce should be stored on context
    expect(event.context.__cspNonce).toBeTruthy()
    expect(typeof event.context.__cspNonce).toBe('string')

    // CSP header should contain the nonce
    const cspCall = vi.mocked(h3.setResponseHeader).mock.calls.find(
      (c: any[]) => c[1] === 'Content-Security-Policy'
    )
    expect(cspCall).toBeTruthy()
    const cspValue = cspCall![2] as string
    expect(cspValue).toContain(`'nonce-${event.context.__cspNonce}'`)
    expect(cspValue).toContain("default-src 'self'")
  })

  it('does not set CSP for non-admin paths', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/api/comments' } as any)

    securityHeaders(event)

    const cspCall = vi.mocked(h3.setResponseHeader).mock.calls.find(
      (c: any[]) => c[1] === 'Content-Security-Policy'
    )
    expect(cspCall).toBeUndefined()
  })
})

// =================================================================
// 01.admin-spa
// =================================================================
describe('01.admin-spa middleware', () => {
  it('skips non-admin paths (passthrough)', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/api/comments' } as any)

    const result = adminSpa(event)
    expect(result).toBeUndefined()
    expect(h3.setResponseHeader).not.toHaveBeenCalled()
  })

  it('skips paths with file extensions (handled by publicAssets)', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/admin/main.js' } as any)

    const result = adminSpa(event)
    expect(result).toBeUndefined()
  })

  it('returns index.html with CSP nonce injected for /admin paths', () => {
    // fs 默认 mock：existsSync=true，readFileSync 返回带 <script> 的 HTML
    const event = makeEvent({ context: { __cspNonce: 'test-nonce-123' } })
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/admin/dashboard' } as any)

    const result = adminSpa(event)

    expect(result).toBeTruthy()
    // All <script> tags should have nonce attribute
    expect(result).toContain('<script nonce="test-nonce-123"')
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Content-Type', 'text/html')
    // Should call readFileSync to load index.html
    expect(fs.readFileSync).toHaveBeenCalled()
  })

  it('falls through to 404 when adminDistDir not built (existsSync false)', async () => {
    // Re-import admin-spa with existsSync=false to simulate missing build output
    vi.doMock('node:fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '<html></html>'),
    }))

    const mod = await import('../middleware/01.admin-spa?t=admin-not-built-' + Date.now())
    const freshAdminSpa = mod.default

    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/admin/dashboard' } as any)

    const result = freshAdminSpa(event)
    expect(result).toBeUndefined()
  })
})

// =================================================================
// 02.cors
// =================================================================
describe('02.cors middleware', () => {
  it('wildcard mode: sets Access-Control-Allow-Origin: * without credentials', async () => {
    const event = makeEvent({ method: 'GET' })
    vi.mocked(coreMocks.getConfig).mockResolvedValueOnce({ CORS_ORIGINS: '*' })
    vi.mocked(h3.getRequestHeader).mockReturnValueOnce('https://example.com')

    const result = await cors(event)

    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Access-Control-Allow-Origin', '*')
    // Wildcard mode MUST NOT send credentials (per CORS spec)
    const credCall = vi.mocked(h3.setResponseHeader).mock.calls.find(
      (c: any[]) => c[1] === 'Access-Control-Allow-Credentials'
    )
    expect(credCall).toBeUndefined()
    expect(result).toBeUndefined()
  })

  it('explicit whitelist: reflects matching origin and sends credentials', async () => {
    const event = makeEvent({ method: 'GET' })
    vi.mocked(coreMocks.getConfig).mockResolvedValueOnce({
      CORS_ORIGINS: 'https://allowed.com,https://other.com',
    })
    vi.mocked(h3.getRequestHeader).mockReturnValueOnce('https://allowed.com')

    await cors(event)

    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Access-Control-Allow-Origin',
      'https://allowed.com'
    )
    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Access-Control-Allow-Credentials',
      'true'
    )
  })

  it('rejects origin not in whitelist (no allow headers)', async () => {
    const event = makeEvent({ method: 'GET' })
    vi.mocked(coreMocks.getConfig).mockResolvedValueOnce({
      CORS_ORIGINS: 'https://allowed.com',
    })
    vi.mocked(h3.getRequestHeader).mockReturnValueOnce('https://evil.com')

    await cors(event)

    // Origin not reflected
    const originCall = vi.mocked(h3.setResponseHeader).mock.calls.find(
      (c: any[]) => c[1] === 'Access-Control-Allow-Origin' && c[2] === 'https://evil.com'
    )
    expect(originCall).toBeUndefined()
    // No credentials
    const credCall = vi.mocked(h3.setResponseHeader).mock.calls.find(
      (c: any[]) => c[1] === 'Access-Control-Allow-Credentials'
    )
    expect(credCall).toBeUndefined()
  })

  it('OPTIONS preflight returns null and sets 204', async () => {
    const event = makeEvent({ method: 'OPTIONS' })
    vi.mocked(coreMocks.getConfig).mockResolvedValueOnce({ CORS_ORIGINS: '*' })

    const result = await cors(event)

    expect(h3.setResponseStatus).toHaveBeenCalledWith(event, 204)
    expect(result).toBeNull()
  })

  it('always sets allow-methods / allow-headers / max-age regardless of origin', async () => {
    const event = makeEvent({ method: 'GET' })
    vi.mocked(coreMocks.getConfig).mockResolvedValueOnce({ CORS_ORIGINS: '*' })
    vi.mocked(h3.getRequestHeader).mockReturnValueOnce('')

    await cors(event)

    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    )
    expect(h3.setResponseHeader).toHaveBeenCalledWith(
      event,
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-Requested-With'
    )
    expect(h3.setResponseHeader).toHaveBeenCalledWith(event, 'Access-Control-Max-Age', '86400')
  })
})

// =================================================================
// 03.rate-limit
// =================================================================
describe('03.rate-limit middleware', () => {
  it('passes through when rate limit allows', async () => {
    const event = makeEvent()
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    const result = await rateLimit(event)

    expect(result).toBeUndefined()
    expect(h3.setResponseStatus).not.toHaveBeenCalledWith(event, 429)
  })

  it('returns 429 with {result:{message}} shape when rate limit exceeded', async () => {
    const event = makeEvent()
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(false)

    const result = await rateLimit(event)

    expect(h3.setResponseStatus).toHaveBeenCalledWith(event, 429)
    expect(result).toEqual({ result: { message: '请求过于频繁，请稍后再试' } })
  })

  it('uses getClientIp from #core via buildRequestContext', async () => {
    const event = makeEvent()
    vi.mocked(coreMocks.getClientIp).mockResolvedValueOnce('1.2.3.4')
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    // getClientIp 应该被调用一次（参数是 buildRequestContext 的结果）
    expect(coreMocks.getClientIp).toHaveBeenCalledTimes(1)
    // checkRateLimit 应该用得到的 IP 和默认 action 调用
    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('1.2.3.4', 'default')
  })

  it('resolves comment action for POST /api/comments', async () => {
    const event = makeEvent({ method: 'POST', path: '/api/comments' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'comment')
  })

  it('resolves login action for /api/auth/*', async () => {
    const event = makeEvent({ path: '/api/auth/email/send' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'login')
  })

  it('does NOT consume login bucket for /api/auth/me (regression: browsing locks out login)', async () => {
    // /api/auth/me 是无副作用的 JWT 现状查询，__takoio_auth 嵌入脚本在每次页面
    // 加载时调用。旧实现让它共享 login 桶（5/15min），用户浏览 5 个页面就会
    // 耗尽 login 桶，反向锁死真正的登录尝试。修复后它应走 default 桶。
    const event = makeEvent({ path: '/api/auth/me?token=abc' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'default')
  })

  it('does NOT consume login bucket for /api/auth/providers', async () => {
    const event = makeEvent({ path: '/api/auth/providers' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'default')
  })

  it('does NOT consume login bucket for /api/auth/logout', async () => {
    const event = makeEvent({ method: 'POST', path: '/api/auth/logout' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'default')
  })

  it('still consumes login bucket for /api/auth/email/verify (brute-forceable)', async () => {
    const event = makeEvent({ method: 'POST', path: '/api/auth/email/verify' })
    vi.mocked(coreMocks.rateLimitStore.checkRateLimit).mockResolvedValueOnce(true)

    await rateLimit(event)

    expect(coreMocks.rateLimitStore.checkRateLimit).toHaveBeenCalledWith('127.0.0.1', 'login')
  })
})

// =================================================================
// 04.logger
// =================================================================
describe('04.logger middleware', () => {
  it('registers finish event handler on res (node-server preset)', () => {
    const event = makeEvent()
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/api/comments' } as any)

    loggerMiddleware(event)

    expect(event.node.res.on).toHaveBeenCalledWith('finish', expect.any(Function))
  })

  it('logs method/url/status/duration on finish event', () => {
    const event = makeEvent({ method: 'POST' })
    vi.mocked(h3.getRequestURL).mockReturnValueOnce({ pathname: '/api/login' } as any)

    // 捕获 finish 回调
    let finishCb: (() => void) | null = null
    event.node.res.on.mockImplementation((evt: string, cb: () => void) => {
      if (evt === 'finish') finishCb = cb
    })

    loggerMiddleware(event)

    // 模拟 res.statusCode = 201
    event.node.res.statusCode = 201
    finishCb!()

    expect(coreMocks.logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/POST \/api\/login 201 \d+ms/)
    )
  })

  it('skips logging when event.node.res is unavailable (serverless)', () => {
    const event = makeEvent({ node: undefined })

    loggerMiddleware(event)

    // No res.on registered, no logger call
    expect(coreMocks.logger.info).not.toHaveBeenCalled()
  })
})
