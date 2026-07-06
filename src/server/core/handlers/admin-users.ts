/**
 * Admin User handlers — list, search, ban/unban users.
 *
 * 最小化管理：无详情页，无角色扩展，不涉及配置系统。
 */

import { userStore } from '../store/index'
import { AppError } from '../errors'

// ========== User List ==========

export const handleGetUsers = async (data: { page?: number; pageSize?: number; search?: string; filter?: string }) => {
  const page = Math.max(1, data.page || 1)
  const pageSize = Math.min(100, Math.max(1, data.pageSize || 20))
  const result = await userStore.getUsers(page, pageSize, data.search || '', data.filter || '')
  return result
}

// ========== Ban User ==========

export const handleBanUser = async (data: { id: string }) => {
  if (!data.id) throw new AppError('INVALID_INPUT', '缺少用户 ID', 400)
  const ok = await userStore.setUserRole(data.id, 'banned')
  if (!ok) throw new AppError('NOT_FOUND', '用户不存在', 404)
  return { success: true }
}

// ========== Unban User ==========

export const handleUnbanUser = async (data: { id: string }) => {
  if (!data.id) throw new AppError('INVALID_INPUT', '缺少用户 ID', 400)
  const ok = await userStore.setUserRole(data.id, 'user')
  if (!ok) throw new AppError('NOT_FOUND', '用户不存在', 404)
  return { success: true }
}
