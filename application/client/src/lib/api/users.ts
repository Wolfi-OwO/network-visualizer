import { api } from './client.ts'

export type Role = 'admin' | 'editor' | 'viewer'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: Role
  provider: string
  avatar?: string
}

// Admin-only account & role management (mirrors the backend /api/users router).
export const users = {
  // `silent`: the admin page handles a non-admin 403 itself (no global overlay).
  list: () => api.get<{ users: AdminUser[]; roles: Role[] }>('/users', { silent: true }),
  setRole: (id: string, role: Role) => api.patch<AdminUser>(`/users/${id}`, { role }),
  remove: (id: string) => api.delete(`/users/${id}`),
}
