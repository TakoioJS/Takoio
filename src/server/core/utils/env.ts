/**
 * 环境判定工具。
 *
 * 主判据 `import.meta.dev` 是 Nitro 编译期常量：dev 模式为 true，生产构建恒为 false。
 * 仅当该字段未被注入时，才回退到 NODE_ENV 兜底。
 *
 * 注意：不能简单用 `import.meta.dev || NODE_ENV === 'development'`，
 * 否则云函数平台（SCF/CloudBase 等）默认注入的 NODE_ENV=development
 * 会让生产构建误判为 dev 模式，导致 Redis 等依赖 isDev() 短路的功能失效。
 */

/** 是否为开发（热开发）模式 */
export function isDev (): boolean {
  const metaDev = (import.meta as any).dev
  if (typeof metaDev === 'boolean') return metaDev
  return process.env.NODE_ENV === 'development'
}

/** 是否为生产模式 */
export function isProd (): boolean {
  return !isDev()
}
