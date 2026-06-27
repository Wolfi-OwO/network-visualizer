import type { Request, Response } from 'express'
import { config, enabledProviders } from '../config/index.js'
import { signSession, SESSION_COOKIE } from '../lib/jwt.js'
import {
  findOrCreateUser, getUserById,
  googleAuthUrl, googleProfile, microsoftAuthUrl, microsoftProfile,
  type PublicUser,
} from '../services/auth-service.js'
import { BadRequestError, NotFoundError, UnauthorizedError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

function setSession(req: Request, res: Response, user: PublicUser): void {
  const token = signSession({ sub: user.id, email: user.email, name: user.name, role: user.role })
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark Secure when actually served over HTTPS, otherwise the browser
    // drops the cookie on plain-HTTP deployments (e.g. http://localhost:8080).
    secure: req.secure,
    maxAge: SEVEN_DAYS,
    path: '/',
  })
}

function callbackUri(provider: string): string {
  return `${config.apiUrl}/api/auth/${provider}/callback`
}

// GET /api/auth/providers — which sign-in options are available.
export function providers(_req: Request, res: Response): void {
  res.json({ providers: enabledProviders(), devLogin: config.allowDevLogin })
}

// GET /api/auth/me — current user (or 401).
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError('Not signed in')
  const user = await getUserById(req.user.id)
  if (!user) throw new NotFoundError('User not found')
  res.json(user)
}

// POST /api/auth/logout
export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ ok: true })
}

// POST /api/auth/dev-login { email, name } — local login for dev/testing only.
export async function devLogin(req: Request, res: Response): Promise<void> {
  if (!config.allowDevLogin) throw new BadRequestError('Dev login is disabled')
  const { email, name } = req.body as { email?: string; name?: string }
  if (!email) throw new BadRequestError('email is required')
  const user = await findOrCreateUser({ provider: 'local', providerId: email, email, name: name || email })
  setSession(req, res, user)
  res.json(user)
}

// ── OAuth (Google / Microsoft) ───────────────────────────────────────────────
export function googleStart(_req: Request, res: Response): void {
  if (!enabledProviders().includes('google')) throw new BadRequestError('Google login is not configured')
  res.redirect(googleAuthUrl(callbackUri('google'), 'google'))
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  await handleCallback(req, res, 'google', googleProfile)
}

export function microsoftStart(_req: Request, res: Response): void {
  if (!enabledProviders().includes('microsoft')) throw new BadRequestError('Microsoft login is not configured')
  res.redirect(microsoftAuthUrl(callbackUri('microsoft'), 'microsoft'))
}

export async function microsoftCallback(req: Request, res: Response): Promise<void> {
  await handleCallback(req, res, 'microsoft', microsoftProfile)
}

// Shared OAuth callback: exchange code → profile → session, and on ANY failure
// redirect to the login page with an error (instead of dumping a 500 page).
async function handleCallback(
  req: Request, res: Response, provider: 'google' | 'microsoft',
  exchange: (code: string, redirectUri: string) => Promise<Parameters<typeof findOrCreateUser>[0]>,
): Promise<void> {
  try {
    const code = req.query.code as string | undefined
    if (req.query.error) throw new Error(String(req.query.error_description ?? req.query.error))
    if (!code) throw new BadRequestError('Missing authorization code')
    const profile = await exchange(code, callbackUri(provider))
    const user = await findOrCreateUser(profile)
    setSession(req, res, user)
    res.redirect(config.appUrl)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'sign-in failed'
    // "fetch failed" hides the real network error in `.cause` (DNS / timeout / TLS).
    const cause = (err as { cause?: unknown }).cause
    const detail = cause instanceof Error ? ` (${cause.message})` : ''
    logger.error(`${provider} OAuth callback failed: ${reason}${detail}`, err)
    res.redirect(`${config.appUrl}/login?error=${encodeURIComponent(`${provider}: ${reason}${detail}`)}`)
  }
}
