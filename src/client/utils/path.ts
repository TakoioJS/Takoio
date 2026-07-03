/**
 * Takoio 工具函数库 — 路径规范化（从 index.ts 拆出，Phase 7 Task 7.1.3）
 */

/** 路径规范化选项 */
export interface NormalizePathOpts {
  pathNormalize?: 'exact' | 'remove-trailing-slash' | 'add-trailing-slash' | 'auto'
  pathTransform?: (path: string) => string
}

/** 根据配置规范化路径（同步，不处理 'auto' — auto 需异步探测由调用方处理） */
export function normalizePath (path: string, opts: NormalizePathOpts): string {
  // pathTransform 优先级最高
  if (opts.pathTransform) return opts.pathTransform(path)
  switch (opts.pathNormalize) {
    case 'remove-trailing-slash':
      return path.replace(/\/+$/, '') || '/'
    case 'add-trailing-slash':
      return path.endsWith('/') ? path : path + '/'
    case 'auto':
    case 'exact':
    default:
      return path
  }
}
