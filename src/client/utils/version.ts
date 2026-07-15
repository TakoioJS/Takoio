/**
 * Takoio 工具函数库 — 版本号（从 index.ts 拆出，Phase 7 Task 7.1.6）
 */

export const version = String(
  typeof __TAKOIO_VERSION__ === 'string' ? __TAKOIO_VERSION__ : '0.0.0'
)
