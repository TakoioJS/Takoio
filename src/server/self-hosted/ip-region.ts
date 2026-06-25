/**
 * IP region lookup — wraps ip2region-ts with lazy init and graceful degradation
 */

import { newWithBuffer, loadContentFromFile, defaultDbFile } from 'ip2region-ts'
import { logger } from './utils/logger'

let ipSearcher: Awaited<ReturnType<typeof newWithBuffer>> | null = null

export const initIpSearcher = (): void => {
  try {
    const buffer = loadContentFromFile(defaultDbFile)
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

export const lookupIpRegion = async (ip: string): Promise<string> => {
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|::ffff:127\.)/.test(ip)) return '内网IP'
  if (!ipSearcher) return ''
  try {
    const result = await ipSearcher.search(ip)
    return parseIpRegion(result.region)
  } catch {
    return ''
  }
}
