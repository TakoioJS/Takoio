/**
 * Config Cache — in-memory cache + getConfig / invalidateConfig.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 */

import { configStore } from './store/index'
import { type TakoioConfig, DEFAULT_CONFIG } from './config-schema'
import { CACHE_TTL } from './constants'

// ========== Config Retrieval + Cache ==========

let configCache: TakoioConfig | null = null
let cacheTimestamp = 0

export const getConfig = async (): Promise<TakoioConfig> => {
  if (configCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return configCache
  }
  const dbConfig = await configStore.getConfig()
  configCache = { ...DEFAULT_CONFIG, ...dbConfig } as TakoioConfig
  cacheTimestamp = Date.now()
  return configCache!
}

export const invalidateConfig = () => {
  configCache = null
  cacheTimestamp = 0
}
