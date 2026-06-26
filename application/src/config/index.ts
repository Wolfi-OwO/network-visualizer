// Centralised application configuration (12-factor: read from the environment).
// Every tunable value lives here so the rest of the code never touches process.env.
export const config = {
  /** Interface/hostname the server binds to */
  host: process.env.HOST ?? '0.0.0.0',
  /** HTTP port the API listens on */
  port: Number(process.env.PORT) || 8080,
  /** Runtime environment */
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** MongoDB connection string */
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/netviz',
  /** Drop & recreate the database on startup (for a clean demo) */
  dbRecreate: process.env.DB_RECREATE === 'true',
  /** Default origins allowed by CORS (localhost/127.0.0.1 on any port) */
  corsOriginPattern: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /** Optional explicit CORS allow-list (comma-separated) — overrides the pattern when set */
  corsAllowList: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Max accepted JSON body size */
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '8mb',

  // ── Auth ─────────────────────────────────────────────────────────────────
  /** Secret used to sign session JWTs */
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  /** How long a session token is valid */
  jwtTtl: process.env.JWT_TTL ?? '7d',
  /** Public base URL of the app (for OAuth redirect URIs) */
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  /** Base URL the API is reached at (for OAuth callbacks) */
  apiUrl: process.env.API_URL ?? 'http://localhost:8080',
  /** Allow the username/password-less dev login (disabled in production by default) */
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === 'true' || process.env.NODE_ENV !== 'production',
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      tenant: process.env.MICROSOFT_TENANT ?? 'common',
    },
  },
} as const

export const isProduction = config.nodeEnv === 'production'

/** Which OAuth providers are configured (have client id + secret). */
export function enabledProviders(): string[] {
  const out: string[] = []
  if (config.oauth.google.clientId && config.oauth.google.clientSecret) out.push('google')
  if (config.oauth.microsoft.clientId && config.oauth.microsoft.clientSecret) out.push('microsoft')
  return out
}

/** Whether a given request Origin is allowed by CORS. */
export function isOriginAllowed(origin: string): boolean {
  return config.corsAllowList.length > 0
    ? config.corsAllowList.includes(origin)
    : config.corsOriginPattern.test(origin)
}
