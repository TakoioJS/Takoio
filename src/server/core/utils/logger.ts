/**
 * 统一日志模块 — 受 LOG_LEVEL 环境变量控制。
 *
 * 用法（兼容 Node console 的两种调用形式）：
 *   logger.info('纯文本消息')
 *   logger.info({ userId: 1 }, '带元数据的消息')   // 先打印对象再打印消息
 *
 * 级别：debug < info < warn < error
 *   - LOG_LEVEL=debug：输出全部（dev 默认）
 *   - LOG_LEVEL=info ：输出 info/warn/error（生产默认）
 *   - LOG_LEVEL=warn ：仅 warn/error
 *   - LOG_LEVEL=error：仅 error
 */

import { isDev, LOG_LEVEL } from '../env'

type Level = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function resolveLevel (): Level {
  const env = LOG_LEVEL
  if (env && ORDER[env] !== undefined) return env
  return isDev() ? 'debug' : 'info'
}

const _level = resolveLevel()

/** 格式化：(metaObj, msg) → "JSON(msg) msg"；单 msg → msg */
function format (args: any[]): string {
  if (args.length >= 2 && args[1] !== undefined) {
    // (meta, msg) 形式
    try {
      return `${JSON.stringify(args[1])} ${args[0]}`
    } catch {
      return `${String(args[1])} ${args[0]}`
    }
  }
  return String(args[0])
}

export const logger = {
  /** 当前生效的日志级别 */
  level: _level,

  debug (...args: any[]): void {
    if (ORDER[_level] <= ORDER.debug) console.debug(format(args))
  },

  info (...args: any[]): void {
    if (ORDER[_level] <= ORDER.info) console.info(format(args))
  },

  warn (...args: any[]): void {
    if (ORDER[_level] <= ORDER.warn) console.warn(format(args))
  },

  error (...args: any[]): void {
    if (ORDER[_level] <= ORDER.error) console.error(format(args))
  },
}

export default logger
