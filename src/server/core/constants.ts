/**
 * Takoio 服务端核心常量集中（Phase 7 Task 7.2）
 *
 * 设计原则：
 * 1. 本文件只导出纯常量（无副作用、无 import 业务模块），避免循环依赖
 * 2. 原定义文件改为 `import { ... } from './constants'` 并 re-export（向后兼容）
 * 3. 跨包常量 API_TIMEOUT_MS 保留在 packages/core/src/api.ts（方案 C，见 baseline 文档）
 *
 * 迁移来源：
 *   - events.ts           : MAX_LISTENERS / LISTENER_TIMEOUT_MS
 *   - auth.ts             : LOGIN_MAX_FAILURES / LOGIN_LOCKOUT_MS
 *   - config.ts           : MAX_UPLOAD_SIZE
 *   - config-cache.ts     : CACHE_TTL
 *   - handlers/comment-submit.ts : COMMENT_WINDOW_MAX / COMMENT_WINDOW_MS / COMMENT_RATE_LIMIT_DEFAULT
 *   - store/utils.ts      : BATCH_SIZE_SQLITE / BATCH_SIZE_PG / BATCH_SIZE_MONGO
 *   - packages/core/src/api.ts : API_TIMEOUT_MS（方案 C，保留原位，不迁移）
 */

// ========== SSE Events (events.ts) ==========

/** 单 URL 最大 SSE 连接数（超过后驱逐最旧 listener） */
export const MAX_LISTENERS = 1000
/** SSE listener 最大生命周期（fallback：sink 无法探测断开时防内存泄漏） */
export const LISTENER_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// ========== Auth Brute-Force Protection (auth.ts) ==========

/** 登录连续失败多少次后锁定 */
export const LOGIN_MAX_FAILURES = 5
/** 登录锁定时长 */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

// ========== Upload (config.ts) ==========

/** 图片上传最大体积（5MB） */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024

// ========== Config Cache (config-cache.ts) ==========

/** 服务端配置内存缓存 TTL（较短 TTL 降低多实例部署下的过期配置） */
export const CACHE_TTL = 15_000 // 15 seconds

// ========== Comment Rate Limit (handlers/comment-submit.ts) ==========

/** 评论滑动窗口：每个 IP 在窗口内最多提交多少条评论 */
export const COMMENT_WINDOW_MAX = 3
/** 评论滑动窗口时长 */
export const COMMENT_WINDOW_MS = 60_000 // 60 seconds
/** cfg.COMMENT_RATE_LIMIT 缺省时的 fallback 默认值（单条评论最小间隔） */
export const COMMENT_RATE_LIMIT_DEFAULT = 30_000 // 30 seconds

// ========== Store Batch Insert (store/utils.ts) ==========

/** SQLite 批量插入分批大小 */
export const BATCH_SIZE_SQLITE = 50

// ========== Cross-Package Note ==========
// API_TIMEOUT_MS = 30_000 仍保留在 packages/core/src/api.ts（方案 C）
// 理由：跨包迁移需引入 packages/core → src/server/core 的包间依赖，
// 与 monorepo 依赖方向相反（packages 应被 server 消费，而非反向），风险较高。
// 见 docs/refactor-baseline.md "常量地图" 小节决策记录。
