/**
 * Store 查询构造助手 — 抽象 sqlite/pg 共享的查询描述
 *
 * 设计原则：仅产出 dialect-neutral 的查询描述（where 字段、排序列与方向、分页参数），
 * 不引用 drizzle 的具体 API（eq/and/desc 等）—— 这些由各后端适配层自行构造，
 * 因为 sqlite 与 pg 的 schema column 来自不同的 drizzle 子模块（sqlite-core / pg-core）。
 *
 * mongodb 的查询模型完全不同（filter doc + skip/limit），不在此抽象范围内。
 */

import type { CommentSort, CommentState } from './types'

/** buildGetCommentsQuery 返回的 dialect-neutral 查询描述 */
export interface GetCommentsQueryDesc {
  /** WHERE 条件：url 匹配 + state 在可见列表内 + 顶层评论（pid IS NULL） */
  where: {
    url: string
    visibleStates: CommentState[]
    pidIsNull: true
  }
  /** ORDER BY：解析后的列名 + 方向，适配层据此选择 comments.created / comments.like */
  orderBy: {
    column: 'created' | 'like'
    direction: 'asc' | 'desc'
  }
  /** LIMIT */
  limit: number
  /** OFFSET */
  offset: number
  /** 原始分页参数（适配层或后续逻辑按需引用） */
  page: number
  pageSize: number
}

/**
 * 构造 getComments 的 dialect-neutral 查询描述。
 *
 * sqlite.ts / postgres.ts 的 getComments 调用此函数拿到描述后，
 * 再各自用 drizzle 的 eq/and/inArray/desc/asc/sql 模板构造方言查询。
 */
export function buildGetCommentsQuery (opts: {
  url: string
  page?: number
  pageSize?: number
  sort?: CommentSort
}): GetCommentsQueryDesc {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 10
  const sort = opts.sort ?? 'newest'

  const orderBy: GetCommentsQueryDesc['orderBy'] =
    sort === 'oldest'
      ? { column: 'created', direction: 'asc' }
      : sort === 'hottest'
        ? { column: 'like', direction: 'desc' }
        : { column: 'created', direction: 'desc' }

  return {
    where: {
      url: opts.url,
      visibleStates: ['visible', 'pending'],
      pidIsNull: true,
    },
    orderBy,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
  }
}
