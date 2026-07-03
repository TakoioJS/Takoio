/**
 * Admin Private Key handlers — get/set raw config keys.
 *
 * 从 admin.ts 抽出（Phase 3 Task 3.3）。
 */

import { safeValidate, PrivateKeyGetSchema, PrivateKeySetSchema } from '../schemas'
import type { PrivateKeyGetData, PrivateKeySetData } from '../schemas'
import { ALLOWED_CONFIG_KEYS, DEFAULT_CONFIG, getConfig } from '../config'
import { configStore } from '../store/index'
import { AppError } from '../errors'

// ========== Private Key Get ==========

export const handlePrivateKeyGet = async (data: PrivateKeyGetData) => {
  const validation = safeValidate(PrivateKeyGetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { key } = validation.data
  if (!ALLOWED_CONFIG_KEYS.includes(key as keyof typeof DEFAULT_CONFIG)) return { data: null }
  const cfg = await getConfig()
  return { data: (cfg as Record<string, any>)[key] || null }
}

// ========== Private Key Set ==========

export const handlePrivateKeySet = async (data: PrivateKeySetData) => {
  const validation = safeValidate(PrivateKeySetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { key, value } = validation.data
  if (!ALLOWED_CONFIG_KEYS.includes(key as keyof typeof DEFAULT_CONFIG)) throw new AppError('INVALID_INPUT', '不允许的配置键', 400)
  await configStore.setConfig(key, value)
  return { success: true }
}
