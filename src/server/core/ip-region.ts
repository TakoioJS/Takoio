/**
 * IP region lookup — wraps ip2region-ts with lazy init and graceful degradation
 *
 * 动态 import ip2region-ts：避免模块被间接引入时（admin handler → comment.ts →
 * ip-region.ts）就加载 xdb 二进制与解析逻辑。initIpSearcher 异步执行文件 I/O，
 * init 插件中 fire-and-forget 不阻塞 server ready；lookupIpRegion 在 searcher
 * 就绪前返回空串，就绪后自动生效。
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './utils/logger'

// ip2region-ts 的 searcher 类型（动态 import 后才可用）
type IpSearcher = { search: (ip: string) => Promise<{ region: string | null }> }

let ipSearcher: IpSearcher | null = null
let initDone = false
let initPromise: Promise<void> | null = null

const cleanRegion = (s: string): string =>
  s.split(' ').filter(p => p && p !== '0').join(' ')

const parseIpRegion = (region: string | null): string => {
  if (!region) return ''
  // ip2region pipe-separated: 国家|区域|省份|城市|运营商
  if (region.includes('|')) {
    const parts = region.split('|')
    const filtered = parts.filter((p, i) => {
      if (p === '0') return false
      if (i === 1) return false
      return true
    })
    return cleanRegion(filtered.join(' '))
  }
  // fallback: other formats with space-separated 0 values
  return cleanRegion(region)
}

/**
 * 解析 xdb 文件路径，优先级：
 * 1. IP2REGION_XDB_PATH 环境变量（自定义部署或调试）
 * 2. 当前模块所在目录的上一级 ip2region.xdb（Nitro bundle 根目录，适用于云函数和自部署）
 * 3. ip2region-ts 包内默认路径（本地 nitro dev）
 */
const resolveXdbPath = (defaultDbFile: string): string | undefined => {
  if (process.env.IP2REGION_XDB_PATH) return process.env.IP2REGION_XDB_PATH

  const bundled = join(dirname(fileURLToPath(import.meta.url)), '..', 'ip2region.xdb')
  if (existsSync(bundled)) return bundled

  if (existsSync(defaultDbFile)) return defaultDbFile

  return undefined
}

export const initIpSearcher = async (): Promise<void> => {
  if (initDone) return
  // 用 promise 做并发互斥，避免重复初始化
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const { loadContentFromFile, newWithBuffer, defaultDbFile } = await import('ip2region-ts')
      const xdbPath = resolveXdbPath(defaultDbFile)

      if (!xdbPath) {
        logger.warn('ip2region.xdb not found, IP lookup disabled')
        initDone = true
        return
      }

      const buffer = loadContentFromFile(xdbPath)
      ipSearcher = newWithBuffer(buffer) as IpSearcher
      initDone = true
      logger.info('IP region searcher initialized')
    } catch (e: any) {
      logger.warn({ error: e.message }, 'Failed to initialize ip2region, IP lookup disabled')
      // 失败时清除 initPromise，允许下次调用重试
      initPromise = null
    }
  })()

  return initPromise
}

export const lookupIpRegion = async (ip: string): Promise<string> => {
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|::ffff:127\.)/.test(ip)) {
    return '内网IP'
  }
  if (!ipSearcher) return ''

  try {
    const result = await ipSearcher.search(ip)
    return parseIpRegion(result.region)
  } catch (e: any) {
    logger.debug({ ip, error: e.message }, 'IP region lookup failed')
    return ''
  }
}
