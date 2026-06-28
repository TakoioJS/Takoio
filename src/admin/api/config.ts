import { api } from './client'

export interface ConfigData {
  [key: string]: any
}

export const configApi = {
  get: () =>
    api.get<{ data: ConfigData }>('/api/admin/config'),

  save: (config: ConfigData) =>
    api.put('/api/admin/config', { config }),

  reset: () =>
    api.delete('/api/admin/config'),

  testEmail: (email: string, template: string) =>
    api.post('/api/admin/email-test', { email, template }),
}
