import { api } from './client.ts'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  avatar?: string
  provider: string
}

export interface ProvidersInfo {
  providers: string[]      // configured OAuth providers, e.g. ['google','microsoft']
  devLogin: boolean        // whether the local dev login is available
}

export const auth = {
  me: () => api.get<AuthUser>('/auth/me'),
  providers: () => api.get<ProvidersInfo>('/auth/providers'),
  devLogin: (email: string, name?: string) => api.post<AuthUser>('/auth/dev-login', { email, name }),
  logout: () => api.post('/auth/logout'),
  // OAuth is a full-page redirect (not XHR), so we expose the URL to navigate to.
  oauthUrl: (provider: 'google' | 'microsoft') => `/api/auth/${provider}`,
}
