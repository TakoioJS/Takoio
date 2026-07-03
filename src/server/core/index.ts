/**
 * Core Facade — `#core` 单一入口（Phase 5 Task 5.1）。
 *
 * nitro/ 层应仅通过 `import { ... } from '#core'` 消费 core 公开 API，
 * 禁止再走 `#core/handlers/*`、`#core/store/*`、`#core/utils/*`、
 * `#core/db/*`、`#core/schemas` 等深层路径（Phase 5 后转 error 级）。
 *
 * ============================================================================
 * 公开 API 清单（仅列 nitro/ 实际消费的符号，由各聚合模块 re-export）
 * ============================================================================
 *
 * Handlers（子任务 5.1.1）:
 *   - admin (聚合): handleCheckSetup / handleLogin / handleLogout / handlePasswordSet
 *                   handleGetConfig / handleSetConfig / handleConfigReset / handleTypeSet
 *                   handleIpRegionGet / handleHiddenFieldsGet
 *                   handleSendNotification / handleEmailTest
 *                   handlePrivateKeyGet / handlePrivateKeySet
 *   - comment (聚合): handleCommentGet / handleCommentSubmit
 *                     handleCommentUpdate / handleCommentDelete / handleCommentHide
 *                     handleCommentGetAdmin / handleCommentSetTop / handleCommentSetSpam
 *                     handleCommentApprove / handleCommentBatch
 *                     handleCommentReactionGet / handleCommentReactionSubmit
 *                     handleCounterGet / handleCounterUpdate
 *                     handleGetCommentsCount / handleGetRecentComments
 *                     handleDashboardStats / handleDashboardTrend
 *                     handleReactionGet / handleReactionSubmit
 *   - import-export: handleImport / handleExport
 *   - summary: handleArticleSummary
 *   - image: handleUploadImage
 *   - comment-submit: handleCommentSubmit (与 comment 聚合同源，冗余 re-export 保证显式覆盖)
 *
 * Store facade（子任务 5.1.2）:
 *   - store/index (聚合): commentStore / configStore / visitorStore / sessionStore
 *                          reactionStore / rateLimitStore / initStore / isStoreInitialized
 *                          getStore / importStore / ensureDb
 *                          + Store 类型 (Comment / CommentInput / CommentStore / ...)
 *   - store/redis: isRedisAvailable / getRedisDiagnostics / getSummaryCache / setSummaryCache
 *                  redisRateLimit / listSummaryCaches / deleteSummaryCacheByUrl
 *                  clearAllSummaryCaches / updateSummaryCache / withRedis / closeRedis
 *                  memoryRateLimit / invalidateCommentListCache
 *
 * 公开模块（子任务 5.1.3）:
 *   - auth: validateOrigin / requireAdmin / initPassword / getAuthHash / verifyCaptcha
 *           checkLoginRateLimit / recordLoginFailure / clearLoginFailures / hashPassword
 *   - auth-social: signToken / verifyToken / createOAuthProviders / generateState
 *                  verifyState / generateVerifyCode / storeVerifyCode / verifyEmailCode
 *                  AuthUser (type)
 *   - config (聚合): getConfig / invalidateConfig / maskSensitiveConfig
 *                    TakoioConfig (type) / MAX_UPLOAD_SIZE
 *   - env: DB_TYPE / isDev / isProd / isServerless / getPresetName
 *           SETUP_TOKEN / TAKOIO_THROTTLE_MS / REDIS_URL / LIBSQL_URL / ...
 *   - errors: AppError / ERR
 *   - moderate: moderateComment / getAuditAction / ModerationResult (type)
 *   - notify: sendNotification / NotifyPayload (type)
 *   - email: sendEmail / EmailConfig (type) / SendEmailResult (type)
 *   - events: runSSEStream (仅此一个公开函数)
 *   - ip-region: initIpSearcher / lookupIpRegion
 *   - schemas: SubmitCommentSchema / GetCommentSchema / LoginSchema / PasswordSetSchema
 *              SetConfigSchema / ImportSchema / UploadImageSchema / ReactionGetSchema / ...
 *
 * Utils（nitro/ 直接消费的工具函数）:
 *   - utils/logger: logger
 *   - utils/ip: getClientIp
 *
 * 类型 re-export:
 *   - ports: RequestContext / SSESink
 *
 * ============================================================================
 * 内部模块边界（不通过 facade 暴露，nitro 禁止直接 import）
 * ============================================================================
 *   - handlers/_comment-shared.ts / _comment-moderation.ts（内部共享）
 *   - handlers/comment-submit-side-effects.ts（内部副作用）
 *   - handlers/admin-*.ts / comment-*.ts（通过 admin.ts / comment.ts 聚合）
 *   - store/sqlite.ts / mongodb.ts / postgres.ts / query-helpers.ts（DB 实现）
 *   - store/types.ts / rate-limit.ts（通过 store/index 聚合）
 *   - db/*（数据库底层）
 *   - utils/crypto.ts / utils/render.ts（内部工具）
 *   - ai-model.ts / config-meta.ts / config-*.ts（内部实现）
 *
 * 设计原则：
 * 1. Facade 仅 re-export 函数与类型，不 re-export 内部实现
 * 2. 各聚合模块（admin.ts / comment.ts / config.ts / store/index.ts）负责子文件聚合
 * 3. tree-shaking 在 Nitro 服务端构建下保证未使用符号被裁剪
 */

// ========== Handlers（子任务 5.1.1）==========
export * from './handlers/admin'
export * from './handlers/comment'
export * from './handlers/import-export'
export * from './handlers/summary'
export * from './handlers/image'
export * from './handlers/comment-submit'

// ========== Store facade（子任务 5.1.2）==========
export * from './store/index'
// Redis 工具 — 被 nitro/ 的 ai/article、ai/summary、admin、health 等路由直接消费
export * from './store/redis'

// ========== 公开模块（子任务 5.1.3）==========
export * from './auth'
export * from './auth-social'
export * from './config'
export * from './env'
export * from './errors'
export * from './moderate'
export * from './notify'
export * from './email'
// events 仅暴露 runSSEStream（notifyComment / cleanupStaleListeners 为内部实现）
export { runSSEStream } from './events'
export * from './ip-region'
export * from './schemas'

// ========== Utils（nitro/ 直接消费的工具函数）==========
export * from './utils/logger'
export * from './utils/ip'

// ========== 类型 re-export ==========
export * from './ports'
