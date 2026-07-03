/**
 * Config management — aggregation re-export.
 *
 * 原 319 行/6 职责的"上帝文件"已按职责拆分（Phase 3 Task 3.4）：
 *   - config-schema.ts : TakoioConfig / DEFAULT_CONFIG / ALLOWED_CONFIG_KEYS / Zod validation / AIProviderConfig
 *   - config-cache.ts  : configCache / getConfig / invalidateConfig / CACHE_TTL
 *   - config-mask.ts   : maskSensitiveValue / publicConfigSubset / maskSensitiveConfig
 *   - config-ai.ts     : serializeAIProviders / deserializeAIProviders
 *   - errors.ts        : AppError / ERR（Phase 3 Task 3.1）
 *
 * 外部 Import 路径保持不变：`import { ... } from '#core/config'` 或 `'../config'`
 * 由本聚合文件统一 re-export。
 *
 * 设计原则：
 * 1. 单一来源：config-meta.ts 的 CONFIG_META 是配置的唯一真实来源
 * 2. 自动同步：ALLOWED_CONFIG_KEYS / HIDDEN_KEYS / MASKED_KEYS / PUBLIC_KEYS 从 CONFIG_META 自动生成
 * 3. 分层暴露：公开配置 → 掩码配置 → 完整配置，逐级增加权限
 *
 * 新增配置键只需编辑 config-meta.ts 一个文件。
 */

// ========== Constants (re-export from constants.ts for backward compat) ==========

export { MAX_UPLOAD_SIZE } from './constants'

// ========== Aggregation Re-exports ==========

export * from './config-schema'
export * from './config-cache'
export * from './config-mask'
export * from './config-ai'
export * from './errors'
