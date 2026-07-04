/**
 * Import / Export handlers — bulk import from various platforms and export
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { ImportSchema, ExportSchema } from '../schemas'
import { commentStore, getStore, importStore } from '../store/index'
import type { CommentInput, Comment, StoreImportData } from '../store/index'
import { AppError } from '../errors'
import { logger } from '../utils/logger'

// ========== Import ==========

type FieldMap = Record<string, string>

/**
 * Sanitize IP field — returns '' for invalid/malformed values like "0 0"
 */
const sanitizeIp = (ip: unknown): string => {
  if (typeof ip !== 'string') return ''
  const trimmed = ip.trim()
  if (!trimmed) return ''
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    const valid = trimmed.split('.').every(n => {
      const num = Number(n)
      return num >= 0 && num <= 255
    })
    return valid ? trimmed : ''
  }
  // IPv6 (简化校验)
  if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')) {
    return trimmed
  }
  return ''
}

const MAPS: Record<string, FieldMap> = {
  valine: {
    id: 'objectId',
    url: 'url',
    nick: 'nick',
    mail: 'mail',
    link: 'link',
    comment: 'comment',
    ua: 'ua',
    ip: 'ip',
    created: 'createdAt',
    pid: 'pid',
    rid: 'rid',
    mailMd5: 'mailMd5',
    sticker: 'sticker',
  },
  waline: {
    id: 'objectId',
    url: 'url',
    nick: 'nick',
    mail: 'mail',
    link: 'link',
    comment: 'comment',
    ua: 'ua',
    ip: 'ip',
    created: 'insertedAt',
    pid: 'pid',
    rid: 'rid',
    state: 'status',
    mailMd5: 'mailMd5',
    sticker: 'sticker',
  },
  twikoo: {
    id: '_id',
    url: 'url',
    nick: 'nick',
    mail: 'mail',
    link: 'link',
    comment: 'comment',
    ua: 'ua',
    ip: 'ip',
    created: 'created',
    pid: 'pid',
    rid: 'rid',
    isSpam: 'isSpam',
    mailMd5: 'mailMd5',
    sticker: 'sticker',
  },
  artalk: {
    id: 'id',
    url: 'page_key',
    nick: 'name',
    mail: 'email',
    link: 'link',
    comment: 'content',
    ua: 'ua',
    ip: 'ip',
    created: 'created_at',
    pid: 'pid',
    rid: 'rid',
    isPinned: 'is_pinned',
    state: 'status',
  },
  disqus: {
    id: 'id',
    url: 'thread',
    nick: 'name',
    mail: 'email',
    comment: 'message',
    ip: 'ip',
    created: 'createdAt',
    pid: 'parent',
    like: 'likes',
    isSpam: 'isSpam',
  },
}

const mapItem = (item: any, map: FieldMap) => {
  const mapped: Record<string, any> = {}
  for (const [our, their] of Object.entries(map)) {
    const val = item[their] ?? item[our]
    if (val !== undefined) mapped[our] = val
  }
  return mapped
}

const toComment = (item: any, source: string) => {
  // ponytail: maps source-specific fields, then fills defaults
  const map = MAPS[source] || {}
  const m = mapItem(item, map)

  const id = String(m.id ?? item._id ?? item.id ?? crypto.randomUUID())
  const rawCreated = m.created ?? item.created ?? item.insertedAt ?? item.time ?? 0
  const created = typeof rawCreated === 'number'
    ? rawCreated
    : new Date(rawCreated).getTime() || Date.now()

  const stateMap: Record<string, string> = {
    approved: 'visible',
    '': 'visible',
    waiting_review: 'pending',
    pending: 'pending',
    spam: 'spam',
    deleted: 'hidden',
  }
  const rawState = m.state ?? item.state
  const state = stateMap[String(rawState).toLowerCase()] || 'visible'

  return {
    id,
    url: m.url ?? item.url ?? '/',
    nick: m.nick ?? item.nick ?? item.name ?? 'Anonymous',
    mail: m.mail ?? item.mail ?? item.email ?? '',
    mailMd5: m.mailMd5 ?? item.mailMd5 ?? '',
    link: m.link ?? item.link ?? '',
    comment: m.comment ?? item.comment ?? item.content ?? '',
    ua: m.ua ?? item.ua ?? item.userAgent ?? '',
    ip: sanitizeIp(m.ip ?? item.ip ?? ''),
    state,
    created,
    updated: null as number | null,
    pid: m.pid ?? item.pid ?? item.rid ?? null, // ponytail: rid fallback for parent refs
    rid: m.rid ?? item.rid ?? null,
    like: m.like ?? item.like ?? 0,
    dislike: item.dislike ?? 0,
    isSpam: m.isSpam ?? item.isSpam ?? false,
    isTop: m.isTop ?? item.isTop ?? false,
    href: item.href ?? null,
    image: m.image ?? item.image ?? null,
    sticker: m.sticker ?? item.sticker ?? null,
    ipRegion: (m.ipRegion ?? item.ipRegion ?? '').split(/[| ]/).filter((p: string) => p && p !== '0').join(' ') || null,
  }
}

const ALLOWED_IMPORT_SOURCES = ['json', 'valine', 'artalk', 'waline', 'twikoo', 'disqus', 'takoio']

export const handleImport = async (source: string, data: any) => {
  if (!ALLOWED_IMPORT_SOURCES.includes(source)) {
    throw new AppError('INVALID_INPUT', `不支持的导入源: ${source}`, 400)
  }
  const validation = safeValidate(ImportSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const raw = validation.data.json || (validation.data as any)[source]
  logger.info({ source, type: typeof raw, length: raw?.length }, 'Importing comments')
  if (!raw) return { count: 0 }

  let parsed: any = []
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (source !== 'takoio' && !Array.isArray(parsed)) parsed = [parsed]
  } catch (e: any) {
    logger.error({ error: e.message }, 'Import parse error')
    return { count: 0, error: 'JSON 格式错误: ' + e.message }
  }

  if (source === 'takoio') {
    await importStore(parsed as StoreImportData)
    return { count: parsed.comments?.length || 0 }
  }

  logger.info({ count: parsed.length }, 'Import records')
  // 批量插入：一次 addComments 走批量 INSERT/bulkWrite，避免 N 次单行写入
  const items = parsed.map((item: any) => toComment(item, source) as CommentInput)
  const count = await commentStore.addComments(items)
  return { count }
}

// ========== Export ==========

/** CSV 列顺序 */
const CSV_COLUMNS = ['id', 'url', 'nick', 'mail', 'link', 'comment', 'created', 'state', 'ip', 'ua', 'pid', 'rid', 'like', 'dislike', 'isSpam', 'isTop', 'isPrivate', 'ipRegion'] as const

/** 将值转义为 CSV 字段（含逗号/引号/换行时包裹双引号） */
function csvEscape (val: unknown): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** 将 Comment 数组序列化为 CSV 字符串（含 BOM + 表头） */
function commentsToCsv (comments: Comment[]): string {
  // BOM 使 Excel 正确识别 UTF-8
  const lines: string[] = ['﻿' + CSV_COLUMNS.map(c => csvEscape(c)).join(',')]
  for (const c of comments) {
    lines.push(CSV_COLUMNS.map(col => csvEscape((c as any)[col])).join(','))
  }
  return lines.join('\n')
}

export const handleExport = async (data: any) => {
  const validation = safeValidate(ExportSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)

  if (data.format === 'takoio') {
    const { configs: _configs, sessions: _sessions, ...rest } = await getStore()
    return { data: rest, total: rest.comments?.length || 0 }
  }

  // 分页拉取：避免单次 LIMIT 99999 查询拖垮 DB / 触发 serverless 超时。
  // 每页 500 条，循环到取完为止；安全上限 200 页（10 万条）防止异常死循环。
  const EXPORT_PAGE_SIZE = 500
  const MAX_PAGES = 200
  const all: Comment[] = []
  let page = 1
  let total = 0
  do {
    const res = await commentStore.getAllComments(page, EXPORT_PAGE_SIZE)
    all.push(...res.data)
    total = res.total
  } while (all.length < total && page++ < MAX_PAGES)

  if (data.format === 'csv') {
    return { data: commentsToCsv(all), total: all.length, format: 'csv' }
  }

  return { data: all, total: all.length }
}
