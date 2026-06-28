import { api } from './client'
import type { Comment, PaginatedResponse } from '@shared/types'

export interface CommentListParams {
  page?: number
  pageSize?: number
  search?: string
  filter?: 'all' | 'visible' | 'hidden' | 'spam' | 'pending'
}

export interface CommentUpdateData {
  nick?: string
  mail?: string
  link?: string
  comment?: string
}

export interface CommentReplyData {
  url: string
  href?: string
  nick: string
  mail?: string
  link?: string
  comment: string
  pid: string
  rid: string
  ua?: string
  title?: string
}

export interface DashboardStats {
  total: number
  today: number
  yesterday: number
  pending: number
  spam: number
  hidden: number
  topCount: number
}

export interface DashboardTrendPoint {
  date: string
  count: number
}

export const commentsApi = {
  list: (params: CommentListParams) =>
    api.get<PaginatedResponse<Comment> & { data: Comment[] }>('/api/comments/admin', params),

  update: (id: string, data: CommentUpdateData) =>
    api.put<Comment>(`/api/comments/${id}`, data),

  reply: (data: CommentReplyData) => {
    const auth = useAuthStore()
    return api.post<Comment>('/api/comments/', { ...data, _token: auth.token })
  },

  hide: (id: string, hide: boolean) =>
    api.patch(`/api/comments/${id}/hide`, { hide }),

  approve: (id: string) =>
    api.patch(`/api/comments/${id}/approve`, {}),

  delete: (id: string) =>
    api.delete(`/api/comments/${id}`),

  toggleTop: (id: string, isTop: boolean) =>
    api.patch(`/api/comments/${id}/top`, { isTop }),

  setSpam: (id: string, isSpam: boolean) =>
    api.patch(`/api/comments/${id}/spam`, { isSpam }),

  refreshIpRegion: (id: string) =>
    api.get<{ ipRegion: string }>(`/api/comments/${id}/ip-region`),

  batchHide: (ids: string[], hide: boolean) =>
    Promise.all(ids.map(id => api.patch(`/api/comments/${id}/hide`, { hide }))),

  batchDelete: (ids: string[]) =>
    Promise.all(ids.map(id => api.delete(`/api/comments/${id}`))),

  batchSpam: (ids: string[], isSpam: boolean) =>
    Promise.all(ids.map(id => api.patch(`/api/comments/${id}/spam`, { isSpam }))),

  batchApprove: (ids: string[]) =>
    Promise.all(ids.map(id => api.patch(`/api/comments/${id}/approve`, {}))),

  getDashboard: () =>
    api.get<DashboardStats>('/api/admin/dashboard'),

  getDashboardTrend: (days = 7) =>
    api.get<DashboardTrendPoint[]>('/api/admin/dashboard/trend', { days }),
}
