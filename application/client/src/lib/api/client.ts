import axios from 'axios'

/** Shared axios instance — all API calls go through `/api`.
 *  `withCredentials` sends the session cookie so per-user data works. */
export const api = axios.create({ baseURL: '/api', withCredentials: true })
