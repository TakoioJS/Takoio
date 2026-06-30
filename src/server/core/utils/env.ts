/**
 * 环境判定工具。
 *
 * Nitro dev 模式下 `import.meta.dev` 为 true；生产构建下为 false。
 * 兼容 `NODE_ENV` 作为兜底（部分 serverless 预设不设置 import.meta.dev）。
 */

/** 是否为开发（热开发）模式 */
export function isDev (): boolean {
  return !!(import.meta as any).dev || process.env.NODE_ENV !== 'production'
}

/** 是否为生产模式 */
export function isProd (): boolean {
  return !isDev()
}
