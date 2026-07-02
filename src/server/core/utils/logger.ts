/**
 * 统一日志模块 — 受 LOG_LEVEL 环境变量控制。
 *
 * 用法：
 *   logger.info('消息')
 *   logger.info({ userId: 1 }, '带元数据的消息')
 *   logger.error(new Error('something'), '操作失败')
 *
 * 级别：debug < info < warn < error
 *   - LOG_LEVEL=debug：输出全部（dev 默认）
 *   - LOG_LEVEL=info ：输出 info/warn/error（生产默认）
 *   - LOG_LEVEL=warn ：仅 warn/error
 *   - LOG_LEVEL=error：仅 error
 *
 * 生产环境输出结构化 JSON，开发环境输出人类可读格式。
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
const _isDev = isDev()

function formatDev (level: Level, args: any[]): string {
  const timestamp = new Date().toISOString()
  const levelTag = `[${level.toUpperCase()}]`.padEnd(7)
  if (args.length >= 2 && typeof args[1] === 'string') {
    // (meta, msg) form
    const meta = args[1]
    const msg = args[0]
    try {
      return `${timestamp} ${levelTag} ${msg} ${JSON.stringify(meta)}`
    } catch {
      return `${timestamp} ${levelTag} ${msg} ${String(meta)}`
    }
  }
  if (args[0] instanceof Error) {
    return `${timestamp} ${levelTag} ${args[0].message}\n${args[0].stack || ''}`
  }
  return `${timestamp} ${levelTag} ${String(args[0])}`
}

function formatJson (level: Level, args: any[]): string {
  const entry: Record<string, any> = {
    time: new Date().toISOString(),
    level,
  }
  if (args.length >= 2 && typeof args[1] === 'string') {
    entry.msg = args[1]
    entry.meta = args[0]
  } else if (args[0] instanceof Error) {
    entry.msg = args[0].message
    entry.stack = args[0].stack
  } else if (typeof args[0] === 'object') {
    Object.assign(entry, args[0])
  } else {
    entry.msg = String(args[0])
  }
  try { return JSON.stringify(entry) } catch { return String(args[0]) }
}

const format = _isDev ? formatDev : formatJson

function log (level: Level, ...args: any[]): void {
  if (ORDER[_level] > ORDER[level]) return
  const line = format(level, args)
  if (level === 'error') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  level: _level,

  debug (...args: any[]): void {
    log('debug', ...args)
  },

  info (...args: any[]): void {
    log('info', ...args)
  },

  warn (...args: any[]): void {
    log('warn', ...args)
  },

  error (...args: any[]): void {
    log('error', ...args)
  },
}

export default logger
