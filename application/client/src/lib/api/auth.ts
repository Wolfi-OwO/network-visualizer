import { authApi } from './client.ts'

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
  // `silent`: a 401 here just means "not signed in" — handled by AuthProvider,
  // so it must not pop the global error overlay.
  me: () => authApi.get<AuthUser>('/me', { silent: true }),
  providers: () => authApi.get<ProvidersInfo>('/providers', { silent: true }),
  devLogin: (email: string, name?: string) => authApi.post<AuthUser>('/dev-login', { email, name }),
  logout: () => authApi.post('/logout'),
  // OAuth is a full-page redirect (not XHR), so we expose the URL to navigate to.
  oauthUrl: (provider: 'google' | 'microsoft') => `/auth/${provider}`,
}
