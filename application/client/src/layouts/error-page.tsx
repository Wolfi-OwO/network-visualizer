import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import ErrorPage from '../pages/error/error-page.tsx'

// Router error boundary (errorElement). Delegates to the shared, dynamic error
// page so a route-level 401/403/404 looks exactly like one thrown by an API
// call; anything else shows the same page's neutral fallback.
export default function RouteErrorPage() {
  const error = useRouteError()
  // 401/403/404 -> the matching page; any other route error -> neutral fallback (0).
  const code = isRouteErrorResponse(error) ? error.status : 0
  return <ErrorPage code={code} />
}
