/**
 * Admin Auth handlers — setup check, login, logout, password set.
 *
 * 从 admin.ts 抽出（Phase 3 Task 3.3）。
 */

import { safeValidate, LoginSchema, PasswordSetSchema } from '../schemas'
import type { LoginData, PasswordSetData } from '../schemas'
import { configStore, sessionStore } from '../store/index'
import { getConfig } from '../config'
import { hashPassword, getAuthHash, updateAuthHashCache, checkLoginRateLimit, recordLoginFailure, clearLoginFailures, verifyCaptcha, requireAdmin, invalidateAdminTokenCache } from '../auth'
import { verifyPassword, needsRehash } from '../utils/crypto'
import { logger } from '../utils/logger'
import { AppError } from '../errors'
import { isDev, SETUP_TOKEN } from '../env'

// ========== Check Setup ==========

// ponytail: SETUP_TOKEN env var gates first-time setup; without it, setup is open (backward compat)

export const handleCheckSetup = async () => {
  const hash = await getAuthHash()
  return { needSetup: !hash, setupTokenRequired: !!SETUP_TOKEN, dev: isDev() }
}

// ========== Login ==========

export const handleLogin = async (data: LoginData, ip?: string) => {
  const validation = safeValidate(LoginSchema, data)
  if (!validation.success) return { success: false, message: '密码格式错误' }

  const hash = await getAuthHash()

  // No password set — first-time setup mode
  if (!hash) {
    return { success: false, needSetup: true, message: '请先创建管理员密码' }
  }

  // CAPTCHA verification：开启后必须提供并校验 captchaToken，不能通过省略字段绕过
  const cfg = await getConfig()
  if (cfg.ENABLE_CAPTCHA) {
    if (!validation.data.captchaToken) {
      return { success: false, message: '请完成人机验证' }
    }
    try {
      await verifyCaptcha(validation.data.captchaToken, cfg)
    } catch (e: any) {
      return { success: false, message: e.message || '人机验证失败' }
    }
  }

  // Brute-force protection
  if (ip) {
    const rateCheck = await checkLoginRateLimit(ip)
    if (!rateCheck.allowed) {
      return { success: false, message: '登录尝试过于频繁，请 15 分钟后再试' }
    }
  }

  const valid = await verifyPassword(hash, validation.data.password)
  if (!valid) {
    if (ip) await recordLoginFailure(ip)
    return { success: false, message: '密码错误' }
  }

  // Login success — clear failure count and create session
  if (ip) await clearLoginFailures(ip)

  // 重哈希：旧哈希 N 低于当前推荐值时，用新参数重新哈希并写回（透明升级）
  if (needsRehash(hash)) {
    try {
      const newHash = await hashPassword(validation.data.password)
      await configStore.setConfig('AUTH_HASH', newHash)
      updateAuthHashCache(newHash)
      logger.info('Admin password rehashed with stronger scrypt parameters')
    } catch (e: any) {
      logger.warn({ error: e.message }, 'Failed to rehash password')
    }
  }

  return { success: true, token: await sessionStore.createToken() }
}

// ========== Logout ==========

export const handleLogout = async (data: { token?: string }) => {
  if (data.token) await sessionStore.removeToken(data.token)
  // 失效 admin token 缓存：登出后旧 token 不应在 60s 缓存窗口内继续通过 isAdminAsync
  invalidateAdminTokenCache(data.token)
  return { success: true }
}

// ========== Password Set ==========

export const handlePasswordSet = async (data: PasswordSetData & { token?: string; setupToken?: string }) => {
  const validation = safeValidate(PasswordSetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  const existingHash = await getAuthHash()

  if (existingHash) {
    // Password already exists — use requireAdmin for unified defense-in-depth check
    // (validates token + ensures AUTH_HASH exists, preventing stale-token bypass after config reset)
    await requireAdmin(data)
  } else {
    // First-time setup — require SETUP_TOKEN in production
    if (!isDev() && !SETUP_TOKEN) {
      throw new AppError('INVALID_INPUT', '生产环境必须配置 SETUP_TOKEN 环境变量才能初始化管理员密码', 403)
    }
    if (SETUP_TOKEN && data.setupToken !== SETUP_TOKEN) {
      throw new AppError('INVALID_INPUT', 'Setup token 不匹配，无法初始化', 403)
    }
  }

  const newHash = await hashPassword(validation.data.password)
  await configStore.setConfig('AUTH_HASH', newHash)
  updateAuthHashCache(newHash)
  // Invalidate all existing sessions on password change
  await sessionStore.removeAllTokens()
  // 失效 admin token 缓存：密码修改后所有旧 token 立即失效，避免 60s 缓存窗口内被用于读取私密评论
  invalidateAdminTokenCache()
  logger.info(existingHash ? 'Admin password updated (all sessions invalidated)' : 'Admin password created (first-time setup)')

  // Return a session token so the user is auto-logged in after setup
  return { success: true, token: await sessionStore.createToken() }
}
