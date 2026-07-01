/**
 * Comment handlers — 聚合导出
 *
 * 所有评论相关 handler 已从 comment.ts 拆分为独立模块：
 * - comment-get.ts    — 评论列表查询
 * - comment-submit.ts  — 评论提交（含审核、限流、通知）
 * - comment-admin.ts   — 管理操作（更新、删除、隐藏、置顶、审核、批量）
 * - comment-reaction.ts — 评论点赞/反应
 * - comment-misc.ts    — 计数器、统计、最近评论、页面反应
 */

export { handleCommentGet } from './comment-get'
export { handleCommentSubmit } from './comment-submit'
export {
  handleCommentUpdate,
  handleCommentDelete,
  handleCommentHide,
  handleCommentGetAdmin,
  handleCommentSetTop,
  handleCommentSetSpam,
  handleCommentApprove,
  handleCommentBatch,
} from './comment-admin'
export {
  handleCommentReactionGet,
  handleCommentReactionSubmit,
} from './comment-reaction'
export {
  handleCounterGet,
  handleCounterUpdate,
  handleGetCommentsCount,
  handleGetRecentComments,
  handleDashboardStats,
  handleDashboardTrend,
  handleReactionGet,
  handleReactionSubmit,
} from './comment-misc'
