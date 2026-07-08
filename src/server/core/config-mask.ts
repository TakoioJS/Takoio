/**
 * Config Masking — sensitive value masking, public subset, masked config.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 * 设计原则：分层暴露 —— 公开配置 → 掩码配置 → 完整配置，逐级增加权限。
 */

import {
  buildHiddenKeys,
  buildMaskedKeys,
  buildPublicKeys,
} from './config-meta'
import { type TakoioConfig, ALLOWED_CONFIG_KEYS } from './config-schema'

const PUBLIC_KEYS = buildPublicKeys()

// ========== Config Classification (auto-generated from CONFIG_META) ==========

const HIDDEN_KEYS = buildHiddenKeys()
const MASKED_KEYS = buildMaskedKeys()

/** 敏感配置键集合（用于掩码处理） */
export const SENSITIVE_CONFIG_KEYS = MASKED_KEYS

/** 公开 API 中必须排除的键（完全隐藏） */
export const PUBLIC_EXCLUDED_KEYS = HIDDEN_KEYS

// ========== Sensitive Config Masking ==========

/**
 * 对敏感值做掩码处理：不再保留任何原始片段，统一返回 ****。
 * 前端回显的掩码值在保存时会被服务端忽略，避免误写入片段。
 */
export const maskSensitiveValue = (value: string): string => {
  if (!value || value.length === 0) return ''
  return '****'
}

/**
 * 公开评论接口专用配置子集：仅返回前端展示必需的非敏感键。
 * maskSensitiveConfig 即便掩码也会泄露前 3+后 4 位密钥片段，
 * 公开接口不应返回任何敏感字段（即便是掩码形式）。
 *
 * 此函数为白名单模式，仅返回明确允许的公开键，其余一律不下发。
 */
export function publicConfigSubset (cfg: TakoioConfig): Partial<TakoioConfig> {
  const out: Record<string, any> = {}
  for (const key of PUBLIC_KEYS) {
    if (key in cfg) out[key] = cfg[key as keyof TakoioConfig]
  }
  return out as Partial<TakoioConfig>
}

export const maskSensitiveConfig = (cfg: TakoioConfig): TakoioConfig => {
  const ALLOWED = new Set<string>(ALLOWED_CONFIG_KEYS)
  const masked: Record<string, any> = {}
  for (const key of ALLOWED) {
    // hidden 键：完全排除，不在任何 API 响应中暴露（包括管理面板）
    if (PUBLIC_EXCLUDED_KEYS.has(key)) continue
    if (key in cfg) masked[key] = cfg[key as keyof TakoioConfig]
  }
  // masked 键：对非空字符串值做掩码保护
  for (const key of SENSITIVE_CONFIG_KEYS) {
    if (masked[key] && typeof masked[key] === 'string' && masked[key].length > 0) {
      masked[key] = maskSensitiveValue(masked[key])
    }
  }
  return masked as TakoioConfig
}
