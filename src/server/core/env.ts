/**
 * 统一环境变量管理模块
 *
 * 所有 process.env 读取必须集中在此，提供类型安全和默认值。
 * 禁止在其他文件中直接读取 process.env。
 */

/** 获取 Nitro preset 名称（小写） */
function getPreset(): string {
  return (process.env.NITRO_PRESET || (import.meta as any).env?.PRESET || '').toLowerCase()
}

/** 是否为开发（热开发）模式 */
export function isDev(): boolean {
  const metaDev = (import.meta as any).dev
  if (typeof metaDev === 'boolean') return metaDev
  return process.env.NODE_ENV === 'development'
}

/** 是否为生产模式 */
export function isProd(): boolean {
  return !isDev()
}

/** 是否为 serverless 部署环境 */
export function isServerless(): boolean {
  const preset = getPreset()
  return preset === 'vercel' || preset === 'netlify' || preset === 'cloudflare'
}

/** 获取当前部署 preset */
export function getPresetName(): string {
  return getPreset()
}

// ========== 数据库配置 ==========

/** 数据库类型：sqlite | mongodb | postgres */
export const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase()

/** SQLite / LibSQL 连接 URL */
export const LIBSQL_URL = process.env.LIBSQL_URL || process.env.TURSO_DB_URL

/** SQLite / LibSQL 认证 Token */
export const LIBSQL_AUTH_TOKEN = process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_DB_TOKEN

/** SQLite 数据目录 */
export const LIBSQL_DATA_DIR = process.env.LIBSQL_DATA_DIR

/** MongoDB 连接 URI */
export const MONGODB_URI = process.env.MONGODB_URI

/** MongoDB 数据库名称 */
export const MONGODB_DB = process.env.MONGODB_DB

// ========== Redis 配置 ==========

/** Redis 连接 URL */
export const REDIS_URL = process.env.REDIS_URL

// ========== 限流配置 ==========

/** 人工延迟（毫秒），默认 0 */
export const TAKOIO_THROTTLE_MS = parseInt(process.env.TAKOIO_THROTTLE || '0', 10)

// ========== 日志配置 ==========

/** 日志级别：debug | info | warn | error */
export const LOG_LEVEL = (process.env.LOG_LEVEL || '').toLowerCase() as 'debug' | 'info' | 'warn' | 'error' | ''

// ========== 部署配置 ==========

/** 初始化设置 Token */
export const SETUP_TOKEN = process.env.SETUP_TOKEN

// ========== 环境信息对象 ==========

/** 完整的环境信息快照（用于诊断和日志） */
export const envSnapshot = {
  dbType: DB_TYPE,
  preset: getPresetName() || 'node-server',
  isServerless: isServerless(),
  isDev: isDev(),
  hasRedis: !!REDIS_URL,
  hasLibSql: !!LIBSQL_URL,
  hasMongoDb: !!MONGODB_URI,
  logLevel: LOG_LEVEL || 'default',
}
