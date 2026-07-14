import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { config, enabledProviders } from '../config/index.js';
import { signSession, SESSION_COOKIE } from '../lib/jwt.js';
import {
  findOrCreateUser,
  getUserById,
  googleAuthUrl,
  googleProfile,
  microsoftAuthUrl,
  microsoftProfile,
  type PublicUser,
} from '../services/auth-service.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function setSession(req: Request, res: Response, user: PublicUser): void {
  const token = signSession({ sub: user.id, email: user.email, name: user.name, role: user.role });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark Secure when actually served over HTTPS, otherwise the browser
    // drops the cookie on plain-HTTP deployments (e.g. http://localhost:8080).
    secure: req.secure,
    maxAge: SEVEN_DAYS,
    path: '/',
  });
}

// OAuth requires an absolute redirect_uri, so build it from the incoming
// request (protocol/host) instead of a statically configured base URL — the
// same build then works on localhost and behind any public domain.
function callbackUri(req: Request, provider: string): string {
  return `${req.protocol}://${req.get('host')}/auth/${provider}/callback`;
}

// GET /auth/providers — which sign-in options are available.
export function providers(_req: Request, res: Response): void {
  res.json({ providers: enabledProviders(), devLogin: config.allowDevLogin });
}

// GET /auth/me — current user (or 401).
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError('Not signed in');
  const user = await getUserById(req.user.id);
  if (!user) throw new NotFoundError('User not found');
  res.json(user);
}

// POST /auth/logout
export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}

// POST /auth/dev-login { email, name } — local login for dev/testing only.
export async function devLogin(req: Request, res: Response): Promise<void> {
  if (!config.allowDevLogin) throw new BadRequestError('Dev login is disabled');
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email) throw new BadRequestError('email is required');
  const user = await findOrCreateUser({
    provider: 'local',
    providerId: email,
    email,
    name: name || email,
  });
  setSession(req, res, user);
  res.json(user);
}

// ── OAuth (Google / Microsoft) ───────────────────────────────────────────────
const OAUTH_STATE_COOKIE = 'netviz_oauth_state';

// Start the flow with a random `state` stored in a short-lived cookie; the
// callback verifies it to prevent login CSRF.
function startOAuth(
  provider: 'google' | 'microsoft',
  req: Request,
  res: Response,
  urlBuilder: (redirectUri: string, state: string) => string,
): void {
  if (!enabledProviders().includes(provider))
    throw new BadRequestError(`${provider} login is not configured`);
  const state = randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 10 * 60 * 1000,
    path: '/auth',
  });
  res.redirect(urlBuilder(callbackUri(req, provider), state));
}

export function googleStart(req: Request, res: Response): void {
  startOAuth('google', req, res, googleAuthUrl);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  await handleCallback(req, res, 'google', googleProfile);
}

export function microsoftStart(req: Request, res: Response): void {
  startOAuth('microsoft', req, res, microsoftAuthUrl);
}

export async function microsoftCallback(req: Request, res: Response): Promise<void> {
  await handleCallback(req, res, 'microsoft', microsoftProfile);
}

// Shared OAuth callback: exchange code -> profile -> session, and on ANY failure
// redirect to the login page with an error (instead of dumping a 500 page).
async function handleCallback(
  req: Request,
  res: Response,
  provider: 'google' | 'microsoft',
  exchange: (code: string, redirectUri: string) => Promise<Parameters<typeof findOrCreateUser>[0]>,
): Promise<void> {
  try {
    const code = req.query.code as string | undefined;
    if (req.query.error) throw new Error(String(req.query.error_description ?? req.query.error));
    if (!code) throw new BadRequestError('Missing authorization code');
    // CSRF: the returned state must match the nonce we set when starting the flow.
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/auth' });
    if (!expectedState || req.query.state !== expectedState) {
      throw new BadRequestError('Invalid OAuth state (possible CSRF)');
    }
    const profile = await exchange(code, callbackUri(req, provider));
    const user = await findOrCreateUser(profile);
    setSession(req, res, user);
    res.redirect('/');
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'sign-in failed';
    const detail = describeCause(err);
    logger.error(`${provider} OAuth callback failed: ${reason}${detail}`, err);
    res.redirect(`/login?error=${encodeURIComponent(`${provider}: ${reason}${detail}`)}`);
  }
}

// "fetch failed" hides the real network error in `.cause`. Surface DNS/timeout/TLS
// codes — and for an AggregateError (IPv6+IPv4 both failed), the nested codes.
function describeCause(err: unknown): string {
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof AggregateError) {
    const codes = cause.errors
      .map((e) => (e as { code?: string }).code || (e as Error)?.message)
      .filter(Boolean);
    return codes.length ? ` (${[...new Set(codes)].join(', ')})` : '';
  }
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    return ` (${code ? `${code}: ` : ''}${cause.message})`;
  }
  return '';
}
