/**
 * Serverless 环境判定工具
 *
 * 集中管理所有 serverless 相关逻辑，消除代码重复。
 */

import { isServerless as _isServerless, getPresetName } from '../env'

export { isServerless, getPresetName } from '../env'

/** Serverless 环境下的特殊处理标记 */
export const SERVERLESS_PRESETS = new Set(['vercel', 'netlify', 'cloudflare'])

/** 是否为传统服务器部署（非 serverless） */
export function isTraditionalServer(): boolean {
  return !_isServerless()
}

/** 获取部署环境描述（用于日志） */
export function getDeploymentDesc(): string {
  const preset = getPresetName()
  if (!preset) return 'node-server (traditional)'
  if (SERVERLESS_PRESETS.has(preset)) return `${preset} (serverless)`
  return `${preset} (traditional)`
}
