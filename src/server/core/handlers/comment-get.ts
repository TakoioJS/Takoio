/**
 * Comment Get — 评论列表查询
 *
 * 私密评论过滤规则：
 * - 默认：isPrivate 评论对所有人隐藏
 * - 博主视角：携带有效 adminToken 时可见所有 isPrivate 评论
 * - 作者本人：携带有效 viewerToken 且该 token 解出的 mailMd5 与评论的 mailMd5 一致时可见
 *   （viewerToken 由 jose 校验，防止伪造 email 导致的 IDOR）
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { GetCommentSchema } from '../schemas'
import type { GetCommentData } from '../schemas'
import { commentStore, userStore } from '../store/index'
import { getConfig, publicConfigSubset } from '../config'
import { getOrSetCommentListCache } from '../store/redis'
import { markMasterComments } from './_comment-shared'
import { AppError } from '../errors'
import { verifyToken } from '../auth-social'
import { isAdminAsync } from '../auth'

export const handleCommentGet = async (data: GetCommentData) => {
  const validation = safeValidate(GetCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, page, pageSize, sort, viewerToken, adminToken } = validation.data
  const targetUrl = url || '/'

  // 解析 token：用于判断"博主"或"作者本人"视角，决定私密评论是否对其可见
  const isMasterViewer = await isAdminAsync(adminToken)
  let viewerMailMd5 = ''
  if (viewerToken) {
    const viewer = await verifyToken(viewerToken)
    if (viewer?.email) {
      // 被封禁用户仅失去"作者本人"私密评论查看特权（不生成 viewerMailMd5），
      // 仍可作为访客正常阅读公开评论，不阻断整个请求。
      const userRecord = await userStore.getUserByEmail(viewer.email).catch(() => null)
      if (userRecord?.role !== 'banned') {
        viewerMailMd5 = crypto.createHash('sha256').update(viewer.email.trim().toLowerCase()).digest('hex')
      }
    }
  }

  // 评论列表缓存：get-or-set 模式，cache miss 时单次 withRedis 内完成 GET→DB→SET
  // 注意：缓存 key 不含 viewer 信息 → 同一 url/page 下不同视角共享缓存，
  // 在 query 后用 filterPrivateComments 二次过滤
  const result = await getOrSetCommentListCache(targetUrl, page, pageSize, sort, () =>
    commentStore.getComments(targetUrl, page, pageSize, sort)
  )

  // 二次过滤：私密评论。
  // 先浅克隆每一项，避免 markMasterComments 直接修改缓存中的原始对象引用。
  const filteredData = (result.data as any[]).map((c: any) => {
    const clone = { ...c }
    if (!clone.isPrivate) return clone
    // 博主可见
    if (isMasterViewer) return clone
    // 作者本人可见（mailMd5 匹配，且 viewer 未被封禁）
    if (viewerMailMd5 && clone.mailMd5 && clone.mailMd5 === viewerMailMd5) return clone
    // 其他视角：用占位替换 content，避免泄露正文
    return { ...clone, comment: '🔒 私密评论', renderedComment: '<p>🔒 私密评论，仅博主与作者本人可见</p>' }
  })

  const rawCfg = await getConfig()
  markMasterComments(filteredData, rawCfg)

  const cfg = publicConfigSubset(rawCfg)
  // 保留原 result.total（数据库总数），不因私密过滤而改变 → 博主视角能看到所有数据量
  return { ...result, data: filteredData, total: result.total, config: cfg }
}
