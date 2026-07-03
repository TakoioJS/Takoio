/**
 * Config Cache — in-memory cache + getConfig / invalidateConfig.
 *
 * 从 config.ts 抽出（Phase 3 Task 3.4）。
 */

import { configStore } from './store/index'
import { type TakoioConfig, DEFAULT_CONFIG } from './config-schema'
import { CACHE_TTL } from './constants'

// ========== Config Retrieval + Cache + Subscriptions ==========

let configCache: TakoioConfig | null = null
let cacheTimestamp = 0

// ponytail: removed subscribeConfigChange / notifyConfigChange — no subscribers exist

export const getConfig = async (event?: { context?: Record<string, any> }): Promise<TakoioConfig> => {
  // Request-level cache: avoid repeated DB reads within a single request
  if (event?.context?.__takoioConfig) return event.context.__takoioConfig as TakoioConfig
  if (configCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    if (event?.context) event.context.__takoioConfig = configCache
    return configCache
  }
  const dbConfig = await configStore.getConfig()
  configCache = { ...DEFAULT_CONFIG, ...dbConfig } as TakoioConfig
  cacheTimestamp = Date.now()
  if (event?.context) event.context.__takoioConfig = configCache
  return configCache!
}

export const invalidateConfig = () => {
  configCache = null
  cacheTimestamp = 0
}
