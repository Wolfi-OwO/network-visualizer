import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// In dev (and any non-CI build) expose the current commit hash so the footer can
// show it. CI/CD sets VITE_APP_REVISION explicitly, and that takes precedence.
if (!process.env.VITE_APP_REVISION) {
  try {
    process.env.VITE_APP_REVISION = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch { /* not a git checkout — leave it unset */ }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
