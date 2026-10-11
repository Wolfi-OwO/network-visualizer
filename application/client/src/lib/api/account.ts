import { api } from './client.ts'

// Data-subject rights (Art. 15/17/20 DSGVO). Both endpoints act on the signed-in
// account only; the server decides what that means.
export const account = {
  // Returned as a blob so the browser can save it as a file rather than parse it.
  exportData: () => api.get<Blob>('/me/export', { responseType: 'blob' }),
  erase: () => api.delete('/me'),
}
