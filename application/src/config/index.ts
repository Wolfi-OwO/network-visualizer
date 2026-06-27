// Centralised application configuration (12-factor: read from the environment).
// Every tunable value lives here so the rest of the code never touches process.env.
import { logger } from '../lib/logger.js'

export const config = {
  /** Interface/hostname the server binds to */
  host: process.env.HOST ?? '0.0.0.0',
  /** HTTP port the API listens on */
  port: Number(process.env.PORT) || 8080,
  /** Runtime environment */
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** MongoDB connection string */
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/netviz',
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
  /** Secret used to sign session JWTs ( `||` so an empty .env value falls back) */
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  /** How long a session token is valid */
  jwtTtl: process.env.JWT_TTL || '7d',
  /** Base URL the API is reached at (for OAuth callbacks) */
  apiUrl: process.env.API_URL || 'http://localhost:8080',
  /** Public base URL of the app users land on after sign-in. When the SPA is
   *  served by the backend (single origin) this is the same as the API URL.
   *  `||` (not `??`) so an empty `APP_URL=` in .env still falls back. */
  appUrl: process.env.APP_URL || process.env.API_URL || 'http://localhost:8080',
  /** Allow the username/password-less dev login (disabled in production by default) */
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === 'true' || process.env.NODE_ENV !== 'production',
  /** Require authentication for topology data (block the anonymous local workspace) */
  requireAuth: process.env.REQUIRE_AUTH === 'true',
  /** How long to keep audit-log entries (days) */
  auditRetentionDays: Number(process.env.AUDIT_RETENTION_DAYS) || 90,
  /** Interval between health samples used for the status page / uptime tracking */
  healthSampleSeconds: Number(process.env.HEALTH_SAMPLE_SECONDS) || 30,
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

const INSECURE_SECRET = 'dev-insecure-secret-change-me'

/**
 * Fail fast on insecure / missing configuration in production. Called from the
 * server entrypoint (not app.ts) so tests can import the app without tripping it.
 */
export function validateConfig(): void {
  if (!isProduction) return
  // Fatal: a default / weak signing secret is never acceptable in production.
  const errors: string[] = []
  if (!process.env.JWT_SECRET || config.jwtSecret === INSECURE_SECRET) {
    errors.push('JWT_SECRET must be set to a strong random value in production')
  } else if (config.jwtSecret.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters')
  }
  if (errors.length > 0) {
    throw new Error(`Insecure configuration:\n  - ${errors.join('\n  - ')}`)
  }
  // Warnings: allowed, but flagged so they aren't left on by accident.
  if (config.allowDevLogin) {
    logger.warn('ALLOW_DEV_LOGIN is enabled in production — disable it unless you need the password-less local login')
  }
}

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
