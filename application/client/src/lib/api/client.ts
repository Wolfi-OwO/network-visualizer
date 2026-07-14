import axios, { type AxiosInstance } from 'axios'

// Allow individual requests to opt out of the global error overlay (used by the
// routine auth check and admin polling, which expect 401/403 and handle it).
declare module 'axios' {
  export interface AxiosRequestConfig {
    silent?: boolean
  }
}

/** The browser event the global error listener reacts to. */
export const HTTP_ERROR_EVENT = 'netviz:httperror'
const HANDLED = new Set([401, 403, 404])

// Always listen for unauthorized / forbidden / not-found anywhere in the app and
// announce them in one consistent way; everything else is left to the caller.
function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, withCredentials: true })
  instance.interceptors.response.use(
    (res) => res,
    (err: { response?: { status?: number }; config?: { silent?: boolean } }) => {
      const status = err?.response?.status
      if (status && HANDLED.has(status) && !err?.config?.silent) {
        window.dispatchEvent(new CustomEvent(HTTP_ERROR_EVENT, { detail: { status } }))
      }
      return Promise.reject(err)
    },
  )
  return instance
}

/** Shared axios instance — all API calls go through `/api`.
 *  `withCredentials` sends the session cookie so per-user data works. */
export const api = createClient('/api')

/** Auth endpoints live under `/auth` (outside the `/api` prefix). */
export const authApi = createClient('/auth')
