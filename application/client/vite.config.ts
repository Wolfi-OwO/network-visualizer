import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error -- plain-JS build helper, no type declarations needed
import { legalDocumentsPlugin } from './tooling/markdown.js'
import { execSync } from 'node:child_process'

// In dev (and any non-CI build) expose the current commit hash so the footer can
// show it. CI/CD sets VITE_APP_REVISION explicitly, and that takes precedence.
if (!process.env.VITE_APP_REVISION) {
  try {
    process.env.VITE_APP_REVISION = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    /* not a git checkout — leave it unset */
  }
}

export default defineConfig({
  plugins: [react(), legalDocumentsPlugin()],
  build: {
    // Vite inlines assets under 4 kB as base64 data: URIs. The small font files were among them, and the
    // Content-Security-Policy (font-src 'self') refuses data: fonts, so those weights never loaded and the
    // console showed one blocked-font error per file on every page. Emitting them as files keeps the policy strict.
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    // The CIDR page renders text that lives in ../src/seo (the server prerenders the same file).
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
