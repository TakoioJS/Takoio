/**
 * Admin Config handlers — get/set/reset config, hidden fields, type, ip region.
 *
 * 从 admin.ts 抽出（Phase 3 Task 3.3）。
 */

import { safeValidate, TypeSetSchema } from '../schemas'
import type { TypeSetData } from '../schemas'
import { configStore, sessionStore, commentStore } from '../store/index'
import { getConfig, maskSensitiveConfig, SENSITIVE_CONFIG_KEYS, DEFAULT_CONFIG, invalidateConfig, validateConfigBatch } from '../config'
import { invalidateAuthHashCache } from '../auth'
import { lookupIpRegion } from '../ip-region'
import { logger } from '../utils/logger'
import { AppError } from '../errors'

// ========== Get Config ==========

export const handleGetConfig = async () => ({ data: maskSensitiveConfig(await getConfig()) })

// ========== Set Config ==========

export const handleSetConfig = async (data: { _ip?: string; config?: Record<string, unknown> } & Record<string, unknown>) => {
  const { _ip, ...rest } = data
  const payload = rest.config ? rest.config : rest

  // AI_PROVIDERS 前端发来的是数组，需在验证前转成 JSON 字符串
  if (Array.isArray(payload.AI_PROVIDERS)) {
    payload.AI_PROVIDERS = JSON.stringify(payload.AI_PROVIDERS)
  }

  // Use centralized validation
  const { valid, skipped } = validateConfigBatch(payload)
  const filtered: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(valid)) {
    // 掩码值（前端回显的 `xxx****yyy`）静默忽略：相当于"未修改"，不写入也不计入 skipped
    // 这样前端保存时不必追踪哪些字段被改动，避免"部分设置项未保存"的误报
    if (SENSITIVE_CONFIG_KEYS.has(key) && typeof value === 'string' && value.includes('****')) {
      continue
    }
    filtered[key] = value
  }

  await configStore.setManyConfig(filtered)
  invalidateConfig()
  return { success: true, ...(Object.keys(skipped).length > 0 ? { skipped } : {}) }
}

// ========== Config Reset ==========

export const handleConfigReset = async () => {
  await configStore.resetConfig()
  await configStore.setManyConfig(DEFAULT_CONFIG as unknown as Record<string, unknown>)
  // 关键：重置配置后清除所有 session token + 失效密码哈希缓存，
  // 防止旧 admin token 在 AUTH_HASH 被清后仍能通过 requireAdmin 校验（权限维持漏洞）
  await sessionStore.removeAllTokens()
  invalidateAuthHashCache()
  invalidateConfig()
  logger.info('Config reset — all sessions invalidated, AUTH_HASH cache cleared')
  return { success: true }
}

// ========== Type Set ==========

export const handleTypeSet = async (data: TypeSetData) => {
  const validation = safeValidate(TypeSetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  await configStore.setConfig('TYPE', validation.data.type)
  return { success: true }
}

// ========== IP Region Get ==========

export const handleIpRegionGet = async (data: { id: string }) => {
  const { id } = data
  const comment = await commentStore.getComment(id)
  if (!comment || !comment.ip) return { ipRegion: '' }
  const region = await lookupIpRegion(comment.ip)
  if (region && comment.id) {
    await commentStore.setCommentIpRegion(comment.id, region)
  }
  return { ipRegion: region }
}

// ========== Hidden Fields Get ==========

export const handleHiddenFieldsGet = async () => {
  const cfg = await getConfig()
  return { data: cfg.REQUIRED_FIELDS || ['nick'] }
}
