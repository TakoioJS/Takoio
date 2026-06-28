import { api } from './client'

export const dataApi = {
  import: (source: string, data: any) =>
    api.post<{ count: number; error?: string }>(`/api/admin/import/${source}`, data),

  export: (format: string) =>
    api.get(`/api/admin/export`, { format }),
}
