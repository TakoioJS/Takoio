/**
 * Takoio 工具函数库 — Barrel Re-export
 *
 * Phase 7 Task 7.1.7：原单文件（163 行）已按职责拆分为 6 个子文件，
 * 外部 import 路径保持不变：`import { logger, getUrl } from '@/utils'` 仍可用。
 *
 * 拆分清单：
 *   - logger.ts      : logger
 *   - render-links.ts: renderLinks
 *   - path.ts        : normalizePath / NormalizePathOpts
 *   - url.ts         : getUrl / getHref / getUserAgent / sanitizeUrl（依赖 ./path）
 *   - toast.ts       : toast
 *   - version.ts     : version
 *
 * 既有 re-export（@takoio/core / ./i18n / ./tex）保持原样。
 */

export * from './logger'
export * from './render-links'
export * from './path'
export * from './url'
export * from './toast'
export * from './version'

export {
  request,
  submitComment,
  getComments,
  getCommentsCountApi,
  getRecentCommentsApi,
  getVisitorsCountApi,
  updateVisitorsCount,
  getReactions,
  toggleReaction,
  getCommentReactions,
  toggleCommentReaction,
  adminRequest,
  uploadImage,
  getArticleSummary,
  classifyApiError,
  isUrl,
} from '@takoio/core'

export type { ApiErrorCategory } from '@takoio/core'

export { setLanguage, t } from './i18n'
export { timeago } from '@takoio/core'
export { renderTex } from './tex'
