/**
 * Authentication — password hashing, brute-force protection, CAPTCHA, admin checks
 */

import { logger } from './utils/logger'
import { configStore, sessionStore } from './store/index'
import { type TakoioConfig } from './config'
import { AppError } from './config'

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
  if (hash) {
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
export const initPassword = async () => {
  try {
    const dbConfig = await configStore.getConfig()
    if (dbConfig.AUTH_HASH) {
      authHashCache = dbConfig.AUTH_HASH
      authHashCacheTime = Date.now()
      logger.info('Admin password loaded from database')
    } else {
      logger.info('No admin password set. Awaiting first-time setup via admin panel.')
    }
  } catch {
    logger.warn('Could not load admin password from database. Awaiting first-time setup.')
  }
}

// ========== Login Brute-Force Protection ==========

// ponytail: in-memory Map for failure counting + Redis for lockout persistence; memory resets on serverless cold start but Redis lockout survives
interface LoginAttempt { failures: number; lockedUntil: number }
const loginAttempts = new Map<string, LoginAttempt>()
const LOGIN_MAX_FAILURES = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const REDIS_LOCKOUT_PREFIX = 'takoio:login-lockout:'

async function isRedisLockedOut (ip: string): Promise<boolean> {
  try {
    const { getRedisClient } = await import('./store/redis')
    const client = await getRedisClient()
    if (!client) return false
    const locked = await client.get(`${REDIS_LOCKOUT_PREFIX}${ip}`)
    return locked === '1'
  } catch { return false }
}

async function setRedisLockout (ip: string): Promise<void> {
  try {
    const { getRedisClient } = await import('./store/redis')
    const client = await getRedisClient()
    if (client) await client.set(`${REDIS_LOCKOUT_PREFIX}${ip}`, '1', 'PX', LOGIN_LOCKOUT_MS)
  } catch { /* best effort */ }
}

async function clearRedisLockout (ip: string): Promise<void> {
  try {
    const { getRedisClient } = await import('./store/redis')
    const client = await getRedisClient()
    if (client) await client.del(`${REDIS_LOCKOUT_PREFIX}${ip}`)
  } catch { /* best effort */ }
}

export const checkLoginRateLimit = async (ip: string): Promise<{ allowed: boolean; remainingAttempts: number }> => {
  // Check Redis lockout first (survives serverless cold starts)
  if (await isRedisLockedOut(ip)) return { allowed: false, remainingAttempts: 0 }

  const now = Date.now()
  const attempt = loginAttempts.get(ip)
  if (!attempt) return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES }

  if (attempt.lockedUntil > 0 && now > attempt.lockedUntil) {
    loginAttempts.delete(ip)
    return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES }
  }

  if (attempt.lockedUntil > 0) return { allowed: false, remainingAttempts: 0 }

  return { allowed: true, remainingAttempts: LOGIN_MAX_FAILURES - attempt.failures }
}

export const recordLoginFailure = async (ip: string) => {
  const now = Date.now()
  const attempt = loginAttempts.get(ip) || { failures: 0, lockedUntil: 0 }
  attempt.failures += 1
  if (attempt.failures >= LOGIN_MAX_FAILURES) {
    attempt.lockedUntil = now + LOGIN_LOCKOUT_MS
    logger.warn({ ip }, `Login locked out after ${LOGIN_MAX_FAILURES} failed attempts`)
    // Persist lockout to Redis so it survives serverless cold starts
    await setRedisLockout(ip)
  }
  loginAttempts.set(ip, attempt)
}

export const clearLoginFailures = async (ip: string) => {
  loginAttempts.delete(ip)
  await clearRedisLockout(ip)
}

// ========== CAPTCHA Verification ==========

export const verifyCaptcha = async (token: string, cfg: TakoioConfig): Promise<void> => {
  if (!cfg.ENABLE_CAPTCHA || !cfg.CAPTCHA_PROVIDER) return

  const provider = cfg.CAPTCHA_PROVIDER
  const secret = cfg.CAPTCHA_SECRET_KEY
  if (!secret) throw new Error('CAPTCHA 密钥未配置 (CAPTCHA_SECRET_KEY)')

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
    }
  } catch (e: any) {
    logger.warn({ error: e.message }, 'CAPTCHA verification failed')
    throw new Error('人机验证失败，请重试')
  }
}

// ========== Admin Auth ==========

export const adminEvents = new Set([
  'COMMENT_DELETE', 'COMMENT_HIDE', 'SET_CONFIG', 'CONFIG_RESET',
  'COMMENT_EXPORT', 'COMMENT_IMPORT_VALINE', 'COMMENT_IMPORT_ARTALK',
  'COMMENT_IMPORT_WALINE', 'COMMENT_IMPORT_TWIKOO', 'COMMENT_IMPORT_DISQUS',
  'COMMENT_GET_ADMIN', 'EMAIL_TEST',
  'COMMENT_SET_TOP', 'COMMENT_SET_SPAM', 'COMMENT_UPDATE',
  'TYPE_SET', 'PRIVATE_KEY_SET',
  'SEND_NOTIFICATION',
])

export const requireAdmin = async (data: any): Promise<void> => {
  const token = data.token
  if (!token || !await sessionStore.validateToken(token)) {
    throw new AppError('NEED_LOGIN', '需要管理员权限，请先登录', 401)
  }
}
