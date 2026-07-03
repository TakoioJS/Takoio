/**
 * Admin handlers — aggregation re-export.
 *
 * 原 274 行/14 handler 的"上帝文件"已按职责拆分（Phase 3 Task 3.3）：
 *   - admin-auth.ts    : setup / login / logout / password set        (4 handlers)
 *   - admin-config.ts  : get/set/reset config / hidden / type / ip region (6 handlers)
 *   - admin-notify.ts  : send notification / email test               (2 handlers)
 *   - admin-key.ts     : private key get/set                          (2 handlers)
 *
 * 外部 import 路径保持不变：`import { handleX } from '#core/handlers/admin'`
 * 由本聚合文件统一 re-export。
 */

export * from './admin-auth'
export * from './admin-config'
export * from './admin-notify'
export * from './admin-key'
