/**
 * Takoio 工具函数库 — 日志工具（从 index.ts 拆出，Phase 7 Task 7.1.1）
 */

/** 日志工具 */
export const logger = {
  log: (message: string, ...args: any[]) => {
    console.log(`Takoio: ${message}`, ...args)
  },
  info: (message: string, ...args: any[]) => {
    console.info(`Takoio: ${message}`, ...args)
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`Takoio: ${message}`, ...args)
  },
  error: (message: string, ...args: any[]) => {
    console.error(`Takoio: ${message}`, ...args)
  }
}
