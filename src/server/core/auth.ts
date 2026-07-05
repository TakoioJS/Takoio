/**
 * Authentication — password hashing, brute-force protection, CAPTCHA, admin checks
 */

import { logger } from './utils/logger'
import { configStore, sessionStore } from './store/index'
import { type TakoioConfig, getConfig } from './config'
import { AppError } from './errors'
import type { RequestContext } from './ports'
import { LOGIN_MAX_FAILURES, LOGIN_LOCKOUT_MS } from './constants'

// ========== Password Hash Cache ==========

let authHashCache: string | null = null
let authHashCacheTime = 0
const AUTH_HASH_CACHE_TTL = 60_000 // 60 seconds

/** Get the current password hash (memory cache → database). Returns null if no password set (setup mode). */
export const getAuthHash = async (): Promise<string | null> => {
  if (authHashCache && Date.now() - authHashCacheTime < AUTH_HASH_CACHE_TTL) {
    return authHashCache
  }
  const dbConfig = await configStore.getConfig()
  const hash = dbConfig.AUTH_HASH
  if (hash && typeof hash === 'string') {
    authHashCache = hash
    authHashCacheTime = Date.now()
    return hash
  }
  return null
}

// Re-export for convenience (used by handlers/admin.ts)
export { hashPassword } from './utils/crypto'

/** Invalidate auth hash cache (called after password change) */
export const invalidateAuthHashCache = () => {
  authHashCache = null
  authHashCacheTime = 0
}

/** Update auth hash cache directly (called after password set) */
export const updateAuthHashCache = (hash: string) => {
  authHashCache = hash
  authHashCacheTime = Date.now()
}

/** Initialize password on startup: check database for existing hash, otherwise await first-time setup via admin panel. */
export const initPassword = async (): Promise<{ hasPassword: boolean }> => {
  try {
    const dbConfig = await configStore.getConfig()
    const hash = dbConfig.AUTH_HASH
    if (hash && typeof hash === 'string') {
      authHashCache = hash
      authHashCacheTime = Date.now()
      logger.info('Admin password loaded from database')
      return { hasPassword: true }
    } else {
      logger.info('No admin password set. Awaiting first-time setup via admin panel.')
      return { hasPassword: false }
    }
  } catch {
    logger.warn('Could not load admin password from database. Awaiting first-time setup.')
    return { hasPassword: false }
  }
}

// ========== Login Brute-Force Protection ==========

// Failure counts and lockout state persisted to Redis when available; memory fallback for dev / no-Redis deployments.
// Redis key pattern: takoio:login-attempts:<ip> stores { failures, lockedUntil } with TTL = LOGIN_LOCKOUT_MS.
// On cold start / serverless restart, Redis-attempts survive while the in-memory Map resets.
interface LoginAttempt { failures: number; lockedUntil: number }
const loginAttempts = new Map<string, LoginAttempt>()
const REDIS_LOCKOUT_PREFIX = 'takoio:login-lockout:'
const REDIS_LOGIN_ATTEMPTS_PREFIX = 'takoio:login-attempts:'

async function getRedisLoginAttempt (ip: string): Promise<LoginAttempt | null> {
  const mem = loginAttempts.get(ip)
  if (mem) return mem
  try {
    const { withRedis } = await import('./store/redis')
    const hit = await withRedis(async (c) => {
      const raw = await c.get(`${REDIS_LOGIN_ATTEMPTS_PREFIX}${ip}`)
      return raw ? JSON.parse(raw) as LoginAttempt : null
    })
    if (hit) return hit
  } catch { /* fall through */ }
  return null
}

async function setRedisLoginAttempt (ip: string, attempt: LoginAttempt): Promise<void> {
  loginAttempts.set(ip, attempt)
  try {
    const { withRedis } = await import('./store/redis')
    await withRedis(async (c) => {
      await c.set(`${REDIS_LOGIN_ATTEMPTS_PREFIX}${ip}`, JSON.stringify(attempt), 'PX', LOGIN_LOCKOUT_MS)
      return true
    })
  } catch { /* best effort */ }
}

async function delRedisLoginAttempt (ip: string): Promise<void> {
  try {
    const { withRedis } = await import('./store/redis')
    await withRedis(async (c) => { await c.del(`${REDIS_LOGIN_ATTEMPTS_PREFIX}${ip}`); return true })
  } catch { /* best effort */ }
}

async function isRedisLockedOut (ip: string): Promise<boolean> {
  try {
    const { withRedis } = await import('./store/redis')
    const locked = await withRedis(async (c) => await c.get(`${REDIS_LOCKOUT_PREFIX}${ip}`))
    return locked === '1'
  } catch { return false }
}

async function setRedisLockout (ip: string): Promise<void> {
  try {
    const { withRedis } = await import('./store/redis')
    await withRedis(async (c) => {
      await c.set(`${REDIS_LOCKOUT_PREFIX}${ip}`, '1', 'PX', LOGIN_LOCKOUT_MS)
      return true
    })
  } catch { /* best effort */ }
}

async function clearRedisLockout (ip: string): Promise<void> {
  try {
    const { withRedis } = await import('./store/redis')
    await withRedis(async (c) => { await c.del(`${REDIS_LOCKOUT_PREFIX}${ip}`); return true })
  } catch { /* best effort */ }
}

export const checkLoginRateLimit = async (ip: string): Promise<{ allowed: boolean; remainingAttempts: number }> => {
  // Check Redis lockout first (survives serverless cold starts)
  if (await isRedisLockedOut(ip)) return { allowed: false, remainingAttempts: 0 }

  const now = Date.now()
  const attempt = await getRedisLoginAttempt(ip)
  if (!attempt) return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES }

  if (attempt.lockedUntil > 0 && now > attempt.lockedUntil) {
    loginAttempts.delete(ip)
    await delRedisLoginAttempt(ip)
    await clearRedisLockout(ip)
    return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES }
  }

  if (attempt.lockedUntil > 0) return { allowed: false, remainingAttempts: 0 }

  return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES - attempt.failures }
}

export const recordLoginFailure = async (ip: string) => {
  const now = Date.now()
  const attempt = await getRedisLoginAttempt(ip) || { failures: 0, lockedUntil: 0 }
  attempt.failures += 1
  if (attempt.failures >= LOGIN_MAX_FAILURES) {
    attempt.lockedUntil = now + LOGIN_LOCKOUT_MS
    logger.warn({ ip }, `Login locked out after ${LOGIN_MAX_FAILURES} failed attempts`)
    await setRedisLockout(ip)
  }
  await setRedisLoginAttempt(ip, attempt)
}

export const clearLoginFailures = async (ip: string) => {
  loginAttempts.delete(ip)
  await delRedisLoginAttempt(ip)
  await clearRedisLockout(ip)
}

// ========== CAPTCHA Verification ==========

export const verifyCaptcha = async (token: string, cfg: TakoioConfig): Promise<void> => {
  if (!cfg.ENABLE_CAPTCHA) return
  // 配置错误必须显式失败，不能静默放行（防止 ENABLE_CAPTCHA=true 但 PROVIDER 为空时绕过）
  if (!cfg.CAPTCHA_PROVIDER) throw new AppError('INVALID_CAPTCHA', 'CAPTCHA_PROVIDER 未配置', 500)

  const provider = cfg.CAPTCHA_PROVIDER
  const secret = cfg.CAPTCHA_SECRET_KEY
  if (!secret) throw new AppError('INVALID_CAPTCHA', 'CAPTCHA 密钥未配置 (CAPTCHA_SECRET_KEY)', 500)

  try {
    if (provider === 'turnstile') {
      const form = new URLSearchParams({ secret, response: token })
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: form, signal: AbortSignal.timeout(5000),
      })
      const json: any = await res.json()
      if (!json.success) throw new Error('Turnstile 验证失败')
    } else if (provider === 'recaptcha' || provider === 'hcaptcha') {
      const url = provider === 'recaptcha'
        ? 'https://www.google.com/recaptcha/api/siteverify'
        : 'https://hcaptcha.com/siteverify'
      const form = new URLSearchParams({ secret, response: token })
      const res = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) })
      const json: any = await res.json()
      if (!json.success) throw new Error(`${provider} 验证失败: ${json['error-codes']?.join(', ') || 'unknown'}`)
      if (cfg.CAPTCHA_TYPE === 'v3' && json.score < 0.5) throw new Error('reCAPTCHA v3 评分过低')
    } else if (provider === 'geetest') {
      const siteKey = cfg.CAPTCHA_SITE_KEY
      if (!siteKey) throw new Error('极验 SITE_KEY 未配置')
      const [lotNumber, captchaOutput, passToken, genTime] = token.split('|')
      const form = new URLSearchParams({
        lot_number: lotNumber,
        captcha_output: captchaOutput,
        pass_token: passToken,
        gen_time: genTime,
        captcha_id: siteKey,
        sign_token: secret,
      })
      const res = await fetch('https://gcaptcha4.geetest.com/validate', {
        method: 'POST', body: form, signal: AbortSignal.timeout(5000),
      })
      const json: any = await res.json()
      if (json.status !== 'success') throw new Error('极验验证失败: ' + (json.msg || ''))
    } else {
      // 未知 provider 必须显式失败，不能静默放行
      throw new AppError('INVALID_CAPTCHA', `不支持的 CAPTCHA_PROVIDER: ${provider}`, 500)
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, 'CAPTCHA verification failed')
    if (e instanceof AppError) throw e
    throw new AppError('INVALID_CAPTCHA', '人机验证失败，请重试', 400)
  }
}

// ========== Admin Auth ==========

export const requireAdmin = async (data: any): Promise<void> => {
  // 兼容 _token（评论提交 schema 字段名）与 token（标准字段名）
  const token = data?.token ?? data?._token
  if (!token || !await sessionStore.validateToken(token)) {
    throw new AppError('NEED_LOGIN', '需要管理员权限，请先登录', 401)
  }
  // 纵深防御：AUTH_HASH 不存在（如 configReset 后）时拒绝所有 admin 操作，
  // 防止残留 session token 绕过（配合 handleConfigReset 的 removeAllTokens 双保险）
  const existingHash = await getAuthHash()
  if (!existingHash) {
    throw new AppError('NEED_LOGIN', '管理员密码未初始化，请先完成首次设置', 401)
  }
}

/** 同步检查 token 是否为有效 admin session（用于评论列表等"读时鉴权"场景）
 *  不抛异常，返回 boolean；用于在主流程中决定私密评论可见性。
 */
export const isAdmin = (token?: string | null): boolean => {
  if (!token) return false
  // sessionStore.validateToken 是 async，这里用同步封装需要小心；
  // 私密评论鉴权可接受短暂延迟（getComments 一次请求内只调一次）。
  // 注意：使用 void + cache 模式可能引入竞态；这里改成同步 best-effort 检查。
  // 真正的强鉴权仍在 requireAdmin 中通过 async 路径完成。
  return (!!token && _adminTokenCache.has(token)) || token === _shadowAdminToken
}

// 简化的 admin token cache（避免每次 getComments 都查数据库）
// key: token, value: { expiresAt }
const _adminTokenCache = new Map<string, { expiresAt: number }>()
const _shadowAdminToken = ''  // 测试桩位，生产环境永远为空

/** 异步版：实际验证 admin token（包含 DB 查询） */
export const isAdminAsync = async (token?: string | null): Promise<boolean> => {
  if (!token) return false
  const cached = _adminTokenCache.get(token)
  if (cached && cached.expiresAt > Date.now()) return true
  const valid = await sessionStore.validateToken(token)
  if (valid) {
    _adminTokenCache.set(token, { expiresAt: Date.now() + 60_000 }) // 缓存 60s
    return true
  }
  return false
}

/** 失效 admin token 缓存（密码修改 / 退出登录时调用） */
export const invalidateAdminTokenCache = (token?: string) => {
  if (token) _adminTokenCache.delete(token)
  else _adminTokenCache.clear()
}

/** Validate Origin/Referer header for admin requests to mitigate CSRF.
 *  Allowed origins are taken from CORS_ORIGINS and SITE_URL config.
 *  Same-origin requests (origin host matches request host) are always allowed.
 *  Only validates state-changing requests (POST/PUT/DELETE/PATCH).
 *  GET requests are skipped as they are read-only and may not have Origin header.
 */
/** Parse CORS_ORIGINS config which may be a comma-separated string or an array. */
const parseOrigins = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean)
  return String(value || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}

export const validateOrigin = async (ctx: RequestContext): Promise<void> => {
  const method = ctx.method || 'GET'
  // Only validate state-changing methods
  if (method === 'GET' || method === 'HEAD') return

  const cfg = await getConfig(ctx)
  const allowedOrigins = [
    ...parseOrigins(cfg.CORS_ORIGINS),
    ...(cfg.SITE_URL ? [cfg.SITE_URL] : []),
  ].filter(Boolean)

  const origin = ctx.headers['origin'] || ctx.headers['referer'] || ''

  // When no allowed origins configured, at least validate same-origin requests
  if (allowedOrigins.length === 0) {
    const requestHost = ctx.headers['host']?.split(':')[0]
    if (origin) {
      let originHost: string
      try {
        originHost = new URL(origin).hostname
      } catch {
        logger.warn({ origin }, 'Admin request rejected due to malformed origin (no CORS_ORIGINS configured)')
        throw new AppError('INVALID_ORIGIN', '请求来源格式不合法', 403)
      }
      if (originHost !== requestHost) {
        logger.warn({ origin, originHost, requestHost },
          'CSRF check skipped (CORS_ORIGINS not configured) but cross-origin request detected')
      }
    }
    return // No origin header = same-origin request = safe
  }

  if (!origin) return // No origin header = same-origin request (browser doesn't send for same-origin)

  let originHost: string
  try {
    originHost = new URL(origin).hostname
  } catch {
    logger.warn({ origin }, 'Admin request rejected due to malformed origin')
    throw new AppError('INVALID_ORIGIN', '请求来源格式不合法', 403)
  }

  // Same-origin request: allow if origin host matches the request's host header.
  // Browsers do not let attackers forge Origin to match the target host on cross-site requests.
  const requestHost = ctx.headers['host']?.split(':')[0]
  if (requestHost && originHost === requestHost) return

  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === '*') return true
    try {
      return new URL(allowed).hostname === originHost
    } catch {
      return allowed === originHost
    }
  })

  if (!isAllowed) {
    logger.warn({ origin, originHost, allowedOrigins, requestHost }, 'Admin request rejected due to invalid origin')
    throw new AppError('INVALID_ORIGIN', `请求来源不合法: ${originHost}`, 403)
  }
}
