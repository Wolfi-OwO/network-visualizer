import { useEffect, useState } from 'react'
import { HTTP_ERROR_EVENT } from '../../lib/api/client.ts'
import ErrorPage from '../../pages/error/error-page.tsx'

// Mounted once at the app root. It listens for the global HTTP error event that
// the axios interceptor fires for unauthorized (401) / forbidden (403) /
// not-found (404) responses, and presents the matching error page as an overlay.
export default function HttpErrorGate() {
  const [code, setCode] = useState<number | null>(null)

  useEffect(() => {
    const onError = (e: Event) => {
      const status = (e as CustomEvent<{ status: number }>).detail?.status
      if (status === 401 || status === 403 || status === 404) setCode(status)
    }
    window.addEventListener(HTTP_ERROR_EVENT, onError)
    return () => window.removeEventListener(HTTP_ERROR_EVENT, onError)
  }, [])

  if (code == null) return null
  return <ErrorPage code={code} overlay onDismiss={() => setCode(null)} />
}
