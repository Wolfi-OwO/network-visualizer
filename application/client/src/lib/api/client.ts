import axios from 'axios'

/** Shared axios instance — all API calls go through `/api`. */
export const api = axios.create({ baseURL: '/api' })
