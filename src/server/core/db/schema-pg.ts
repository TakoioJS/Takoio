/**
 * PostgreSQL schema — 薄封装，表定义已迁入 ./schema-shared.ts 的 defineSchema 工厂。
 *
 * 外部用法保持不变：
 * - `import { comments } from './schema-pg'`（命名导入）
 * - `import * as schema from './schema-pg'`（namespace，用于 drizzle(client, { schema })）
 */

import { defineSchema } from './schema-shared'

const _schema = defineSchema('pg')

export const comments = _schema.comments
export const configs = _schema.configs
export const visitors = _schema.visitors
export const sessions = _schema.sessions
export const rateLimits = _schema.rateLimits
export const reactions = _schema.reactions
export const commentReactions = _schema.commentReactions
