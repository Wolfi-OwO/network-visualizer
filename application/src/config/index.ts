// Centralised application configuration (12-factor: read from the environment).
// Every tunable value lives here so the rest of the code never touches process.env.
export const config = {
  /** Interface/hostname the server binds to */
  host: process.env.HOST ?? '0.0.0.0',
  /** HTTP port the API listens on */
  port: Number(process.env.PORT) || 8080,
  /** Runtime environment */
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** Default origins allowed by CORS (localhost/127.0.0.1 on any port) */
  corsOriginPattern: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /** Optional explicit CORS allow-list (comma-separated) — overrides the pattern when set */
  corsAllowList: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Max accepted JSON body size */
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '8mb',
} as const

export const isProduction = config.nodeEnv === 'production'

/** Whether a given request Origin is allowed by CORS. */
export function isOriginAllowed(origin: string): boolean {
  return config.corsAllowList.length > 0
    ? config.corsAllowList.includes(origin)
    : config.corsOriginPattern.test(origin)
}
