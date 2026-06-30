/**
 * IP region lookup — wraps ip2region-ts with lazy init and graceful degradation
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { newWithBuffer, loadContentFromFile, defaultDbFile } from 'ip2region-ts'
import { logger } from './utils/logger'

// Candidate xdb file paths, in priority order:
//   1. ip2region-ts default (local dev: node_modules/ip2region-ts/data/ip2region.xdb
//      resolved via __dirname of the package's dist/index.js)
//   2. CWD-relative node_modules path (Vercel/Netlify after esbuild bundle:
//      __dirname no longer points into node_modules, so use process.cwd())
const xdbCandidates = [
  defaultDbFile,
  join(process.cwd(), 'node_modules/ip2region-ts/data/ip2region.xdb'),
]

let ipSearcher: Awaited<ReturnType<typeof newWithBuffer>> | null = null

export const initIpSearcher = (): void => {
  const xdbFile = xdbCandidates.find(p => existsSync(p))
  if (!xdbFile) {
    logger.warn('ip2region.xdb not found in candidate paths, IP lookup disabled')
    return
  }
  try {
    const buffer = loadContentFromFile(xdbFile)
    ipSearcher = newWithBuffer(buffer)
    logger.info('IP region searcher initialized (ip2region)')
  } catch (e: any) {
    logger.warn({ error: e.message }, 'Failed to initialize ip2region, IP lookup disabled')
  }
}

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

// LRU 缓存：同一 IP 短时间内重复查询命中缓存，避免重复 ip2region 查询
const _ipRegionCache = new Map<string, { region: string; expire: number }>()
const IP_REGION_CACHE_TTL = 3600_000 // 1 小时
const IP_REGION_CACHE_MAX = 5000

export const lookupIpRegion = async (ip: string): Promise<string> => {
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|::ffff:127\.)/.test(ip)) return '内网IP'
  if (!ipSearcher) return ''

  // 命中缓存
  const cached = _ipRegionCache.get(ip)
  if (cached) {
    if (cached.expire > Date.now()) return cached.region
    _ipRegionCache.delete(ip)
  }

  try {
    const result = await ipSearcher.search(ip)
    const region = parseIpRegion(result.region)
    // 写入缓存，超容量时淘汰最旧
    if (_ipRegionCache.size >= IP_REGION_CACHE_MAX) {
      const firstKey = _ipRegionCache.keys().next().value
      if (firstKey) _ipRegionCache.delete(firstKey)
    }
    _ipRegionCache.set(ip, { region, expire: Date.now() + IP_REGION_CACHE_TTL })
    return region
  } catch {
    return ''
  }
}
