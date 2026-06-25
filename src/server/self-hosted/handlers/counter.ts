/**
 * Counter handlers — visitor count, comments count, recent comments
 */

import * as crypto from 'node:crypto'
import { safeValidate } from '../schemas'
import { CounterGetSchema, CounterUpdateSchema, CommentsCountSchema, RecentCommentsSchema } from '../schemas'
import { commentStore, visitorStore } from '../store/index'
import { AppError } from '../utils/errors'
import { getConfig } from '../config'

// ========== Counter Get ==========

export const handleCounterGet = async (data: any) => {
  const validation = safeValidate(CounterGetSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data
  return visitorStore.getVisitorCount(url || '/', title)
}

// ========== Counter Update ==========

export const handleCounterUpdate = async (data: any) => {
  const validation = safeValidate(CounterUpdateSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const { url, title } = validation.data
  return visitorStore.getVisitorCount(url ?? '/', title)
}

// ========== Get Comments Count ==========

export const handleGetCommentsCount = async (data: any) => {
  const validation = safeValidate(CommentsCountSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  return { data: await commentStore.getCommentsCount(validation.data.urls) }
}

// ========== Get Recent Comments ==========

export const handleGetRecentComments = async (data: any) => {
  const validation = safeValidate(RecentCommentsSchema, data)
  if (!validation.success) throw new AppError('INVALID_INPUT', validation.error, 400)
  const result = await commentStore.getRecentComments(validation.data.count)

  const rawCfg = await getConfig()
  const masterMailMd5 = rawCfg.MASTER ? crypto.createHash('md5').update(rawCfg.MASTER.trim().toLowerCase()).digest('hex') : ''
  const masterName = rawCfg.MASTER_NAME || ''
  
  const checkMaster = (c: any) => {
    if ((masterName && c.nick === masterName) || (masterMailMd5 && c.mailMd5 === masterMailMd5)) {
      c.isMaster = true
    }
  }
  result.forEach(checkMaster)

  return { data: result }
}
