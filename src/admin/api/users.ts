import { api } from './client'

export interface UserItem {
  id: string
  provider: string
  providerId: string
  email: string
  name: string
  avatar?: string | null
  role: string
  createdAt: number
  lastLoginAt: number
  loginCount: number
}

export interface UsersResult {
  data: UserItem[]
  total: number
}

export const usersApi = {
  async list (page = 1, pageSize = 20, search = '', filter = ''): Promise<UsersResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('search', search)
    if (filter) params.set('filter', filter)
    return api.get(`/api/admin/users?${params}`)
  },

  async ban (id: string): Promise<void> {
    return api.patch(`/api/admin/users/${id}/ban`)
  },

  async unban (id: string): Promise<void> {
    return api.patch(`/api/admin/users/${id}/unban`)
  },
}