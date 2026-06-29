import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import { router } from './router.tsx'
import { ToastProvider } from './context/toast-context.tsx'
import { AuthProvider } from './context/auth-context.tsx'
import StatusPage from './pages/status/status-page.tsx'

// Status page lives on its own `status.` subdomain (like status.discord.com /
// status.anthropic.com) — a public, dependency-free page with no app shell,
// router or auth. Everything else is the normal single-page app.
const onStatusSubdomain = window.location.hostname.split('.')[0] === 'status'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {onStatusSubdomain ? (
      <StatusPage />
    ) : (
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    )}
  </StrictMode>,
)
