/**
 * Admin / Config / Auth handlers — login, logout, config CRUD, password, notifications, etc.
 */

import { safeValidate, ALLOWED_CONFIG_KEYS, LoginSchema, PasswordSetSchema } from '../schemas'
import type { LoginData, PasswordSetData } from '../schemas'
import { configStore, sessionStore } from '../store/index'
import { getConfig, maskSensitiveConfig, SENSITIVE_CONFIG_KEYS, DEFAULT_CONFIG, invalidateConfig } from '../config'
import { hashPassword, getAuthHash, updateAuthHashCache, checkLoginRateLimit, recordLoginFailure, clearLoginFailures, verifyCaptcha } from '../auth'
import { verifyPassword } from '../utils/crypto'
import { lookupIpRegion } from '../ip-region'
import { commentStore } from '../store/index'
import { sendNotification } from '../notify'
import { sendEmail } from '../email'
import { AppError } from '../config'

// ========== Check Setup ==========

export const handleCheckSetup = async () => {
  const hash = await getAuthHash()
  return { needSetup: !hash }
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

  // CAPTCHA verification
  if (validation.data.captchaToken) {
    const cfg = await getConfig()
    try {
      await verifyCaptcha(validation.data.captchaToken, cfg)
    } catch (e: any) {
      return { success: false, message: e.message || '人机验证失败' }
    }
  }

  // Brute-force protection
  if (ip) {
    const rateCheck = checkLoginRateLimit(ip)
    if (!rateCheck.allowed) {
      return { success: false, message: '登录尝试过于频繁，请 15 分钟后再试' }
    }
  }

  const valid = await verifyPassword(hash, validation.data.password)
  if (!valid) {
    if (ip) recordLoginFailure(ip)
    return { success: false, message: '密码错误' }
  }

  // Login success — clear failure count and create session
  if (ip) clearLoginFailures(ip)
  return { success: true, token: await sessionStore.createToken() }
}

// ========== Logout ==========

export const handleLogout = async (data: any) => {
  if (data.token) await sessionStore.removeToken(data.token)
  return { success: true }
}

// ========== Get Config ==========

export const handleGetConfig = async (_: any) => ({ data: maskSensitiveConfig(await getConfig()) })

// ========== Set Config ==========

export const handleSetConfig = async (data: any) => {
  const { _ip, ...rest } = data
  const payload = rest.config ? rest.config : rest
  const ALLOWED = new Set<string>(ALLOWED_CONFIG_KEYS)
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED.has(key)) continue
    if (SENSITIVE_CONFIG_KEYS.has(key) && typeof value === 'string' && value.includes('****')) continue
    filtered[key] = value
  }
  await configStore.setManyConfig(filtered)
  invalidateConfig()
  return { success: true }
}

// ========== Config Reset ==========

export const handleConfigReset = async (_: any) => {
  await configStore.resetConfig()
  await configStore.setManyConfig(DEFAULT_CONFIG)
  return { success: true }
}

// ========== Password Set ==========

export const handlePasswordSet = async (data: PasswordSetData & { token?: string; _token?: string }) => {
  const validation = safeValidate(PasswordSetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  const existingHash = await getAuthHash()

  if (existingHash) {
    // Password already exists — require admin auth to change
    const token = data.token || data._token
    if (!token || !await sessionStore.validateToken(token)) {
      throw new AppError('NEED_LOGIN', '需要管理员权限才能修改密码', 401)
    }
  }
  // If no existing hash → first-time setup, no auth required

  const newHash = await hashPassword(validation.data.password)
  await configStore.setConfig('AUTH_HASH', newHash)
  updateAuthHashCache(newHash)
  // Invalidate all existing sessions on password change
  await sessionStore.removeAllTokens()
  console.info(existingHash ? 'Admin password updated (all sessions invalidated)' : 'Admin password created (first-time setup)')

  // Return a session token so the user is auto-logged in after setup
  return { success: true, token: await sessionStore.createToken() }
}

// ========== Type Set ==========

export const handleTypeSet = async (data: any) => {
  const cfg = await getConfig()
  cfg.TYPE = data.type || 'self-hosted'
  await configStore.setConfig('TYPE', cfg.TYPE)
  return { success: true }
}

// ========== IP Region Get ==========

export const handleIpRegionGet = async (data: any) => {
  const { id } = data
  const comment = await commentStore.getComment(id)
  if (!comment || !comment.ip) return { ipRegion: '' }
  const region = await lookupIpRegion(comment.ip)
  if (region && comment.id) {
    await commentStore.setCommentIpRegion(comment.id, region)
  }
  return { ipRegion: region }
}

// ========== Private Key Get ==========

export const handlePrivateKeyGet = async (data: any) => {
  const { key } = data
  if (!key) return { data: null }
  if (!ALLOWED_CONFIG_KEYS.includes(key as any)) return { data: null }
  const cfg = await getConfig()
  return { data: (cfg as Record<string, any>)[key] || null }
}

// ========== Private Key Set ==========

export const handlePrivateKeySet = async (data: any) => {
  const { key, value } = data
  if (!key) throw new AppError('INVALID_INPUT', 'key is required', 400)
  if (!ALLOWED_CONFIG_KEYS.includes(key as any)) throw new AppError('INVALID_INPUT', '不允许的配置键', 400)
  await configStore.setConfig(key, value)
  return { success: true }
}

// ========== Send Notification ==========

export const handleSendNotification = async (data: any) => {
  const cfg = await getConfig()
  const { title, content } = data
  await sendNotification(cfg, { title: title || 'Takoio 通知', content: content || '' })
  return { success: true }
}

// ========== Hidden Fields Get ==========

export const handleHiddenFieldsGet = async () => {
  const cfg = await getConfig()
  return { data: cfg.REQUIRED_FIELDS || ['nick'] }
}

// ========== Email Test ==========

const renderTemplate = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{ (\w+) \}\}/g, (_, k: string) => vars[k] || `{{ ${k} }}`)

export const handleEmailTest = async (data: any) => {
  const cfg = await getConfig()
  if (data.email) cfg.SMTP_TO = data.email

  const isAdmin = data.template === 'admin'
  const subject = isAdmin
    ? (cfg.MAIL_SUBJECT_ADMIN || '新的评论：{nick} 在 {title}')
    : (cfg.MAIL_SUBJECT || '有人在 {title} 中回复了你')
  const rawTpl = isAdmin
    ? (cfg.MAIL_TEMPLATE_ADMIN || cfg.MAIL_TEMPLATE)
    : (cfg.MAIL_TEMPLATE || cfg.MAIL_TEMPLATE_ADMIN)

  const vars = {
    siteName: cfg.SITE_NAME || 'Takoio',
    nick: '访客昵称',
    title: '文章标题',
    comment: '这是一条测试评论的内容。如果能看到这条消息，说明邮件模板配置正确。',
    url: 'https://example.com',
    ip: '127.0.0.1',
    ua: 'Mozilla/5.0 TestBrowser',
  }
  const html = renderTemplate(rawTpl, vars)
  const result = await sendEmail(cfg, renderTemplate(subject, vars), html)

  // Return full result with log entries for admin UI display
  return {
    success: result.success,
    message: result.message,
    log: result.log,
    messageId: result.messageId,
  }
}
