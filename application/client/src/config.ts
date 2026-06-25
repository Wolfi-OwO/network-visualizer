// Centralised frontend configuration — every tunable value is read from a
// Vite environment variable (VITE_*) with a sensible default.
export const appConfig = {
  name: import.meta.env.VITE_APP_NAME ?? 'NetViz',
  version: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
  company: import.meta.env.VITE_APP_COMPANY ?? 'Woofi-Developments',
  repoLabel: import.meta.env.VITE_REPO_LABEL ?? 'Wolfi-OwO/routing-visualizer',
  repoUrl: import.meta.env.VITE_REPO_URL ?? 'https://github.com/Wolfi-OwO/routing-visualizer',
} as const
