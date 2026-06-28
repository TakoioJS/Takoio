export interface ApiError extends Error {
  status?: number
  data?: any
}

const BASE_URL = ''
let _onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  _onUnauthorized = handler
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const auth = useAuthStore()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (auth.token && !url.includes('/login') && !url.includes('/setup')) {
    headers.Authorization = `Bearer ${auth.token}`
  }

  try {
    const res = await fetch(BASE_URL + url, {
      ...options,
      headers,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const error = new Error(data.message || `请求失败 (${res.status})`) as ApiError
      error.status = res.status
      error.data = data
      if (res.status === 401) {
        auth.logout()
        _onUnauthorized?.()
      }
      throw error
    }

    return data as T
  } catch (e: any) {
    if (e.status) throw e
    const error = new Error(e.message || '网络请求失败') as ApiError
    throw error
  }
}

export const api = {
  get<T>(url: string, params?: Record<string, any>) {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
    ).toString() : ''
    return request<T>(url + qs)
  },

  post<T>(url: string, data?: any) {
    return request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  put<T>(url: string, data?: any) {
    return request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  patch<T>(url: string, data?: any) {
    return request<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  delete<T>(url: string) {
    return request<T>(url, { method: 'DELETE' })
  },
}
