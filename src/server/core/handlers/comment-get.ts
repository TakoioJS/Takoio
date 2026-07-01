/**
 * Comment Get — 评论列表查询
 */

import { safeValidate } from '../schemas'
import { GetCommentSchema } from '../schemas'
import type { GetCommentData } from '../schemas'
import { commentStore } from '../store/index'
import { getConfig, publicConfigSubset } from '../config'
import { getOrSetCommentListCache } from '../store/redis'
import { markMasterComments } from './_comment-shared'
import { AppError } from '../config'

export const handleCommentGet = async (data: GetCommentData) => {
  const validation = safeValidate(GetCommentSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, page, pageSize, sort } = validation.data
  const targetUrl = url || '/'

  // 评论列表缓存：get-or-set 模式，cache miss 时单次 withRedis 内完成 GET→DB→SET
  const result = await getOrSetCommentListCache(targetUrl, page, pageSize, sort, () =>
    commentStore.getComments(targetUrl, page, pageSize, sort)
  )

  const rawCfg = await getConfig()
  markMasterComments(result.data, rawCfg)

  const cfg = publicConfigSubset(rawCfg)
  return { ...result, config: cfg }
}
