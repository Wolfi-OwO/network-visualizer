// Centralised frontend configuration — every tunable value is read from a
// Vite environment variable (VITE_*) with a sensible default.
//
// The fields mirror the OpenContainer (OCI) image spec annotations
// (org.opencontainers.image.*) so the app and its Docker image describe
// themselves the same way. Vite bakes these in at build time, so set the VITE_*
// vars when building the client (see application/client/.env.example and the CD
// workflows, which fill version/revision/created from the release + git).
export const appConfig = {
  name: import.meta.env.VITE_APP_NAME ?? 'NetViz',                                            // image.title
  version: import.meta.env.VITE_APP_VERSION ?? '1.0.0',                                       // image.version
  description: import.meta.env.VITE_APP_DESCRIPTION ?? 'Enterprise network visualizer & packet simulator', // image.description
  company: import.meta.env.VITE_APP_COMPANY ?? 'Woofi-Developments',                          // image.vendor
  authors: import.meta.env.VITE_APP_AUTHORS ?? 'Woofi-Developments',                          // image.authors
  url: import.meta.env.VITE_APP_URL ?? 'https://github.com/Wolfi-OwO/network-visualizer',     // image.url
  licenses: import.meta.env.VITE_APP_LICENSES ?? 'MIT',                                       // image.licenses
  mode: import.meta.env.MODE,   // 'development' under `vite dev`, 'production' for builds
  revision: import.meta.env.VITE_APP_REVISION ?? '',                                          // image.revision (git sha)
  created: import.meta.env.VITE_APP_CREATED ?? '',                                            // image.created (build timestamp)
  repoLabel: import.meta.env.VITE_REPO_LABEL ?? 'Wolfi-OwO/network-visualizer',
  repoUrl: import.meta.env.VITE_REPO_URL ?? 'https://github.com/Wolfi-OwO/network-visualizer', // image.source
} as const
