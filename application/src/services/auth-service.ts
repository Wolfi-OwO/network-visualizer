import { v4 as uuidv4 } from 'uuid'
import { UserModel } from '../db/models/user.model.js'
import { config } from '../config/index.js'
import { BadRequestError } from '../lib/errors.js'

export interface OAuthProfile {
  provider: 'google' | 'microsoft' | 'local'
  providerId: string
  email: string
  name: string
  avatar?: string
}

export interface PublicUser { id: string; email: string; name: string; role: string; avatar?: string; provider: string }

function toPublic(doc: NonNullable<Awaited<ReturnType<typeof UserModel.findOne>>>): PublicUser {
  const u = doc.toJSON() as unknown as PublicUser
  return u
}

/** Find an existing user for this identity, or create one. First user = admin. */
export async function findOrCreateUser(p: OAuthProfile): Promise<PublicUser> {
  let doc = await UserModel.findOne({ provider: p.provider, providerId: p.providerId })
  if (!doc) {
    const count = await UserModel.countDocuments()
    doc = await UserModel.create({
      id: uuidv4(),
      email: p.email,
      name: p.name,
      avatar: p.avatar,
      provider: p.provider,
      providerId: p.providerId,
      role: count === 0 ? 'admin' : 'editor',
      createdAt: Date.now(),
    })
  }
  return toPublic(doc)
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const doc = await UserModel.findOne({ id })
  return doc ? toPublic(doc) : null
}

// ── OAuth authorization-code → profile ───────────────────────────────────────
export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Surface the provider's actual error (status + body) instead of a generic message.
async function oauthFail(provider: string, stage: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => '')
  throw new BadRequestError(`${provider} ${stage} failed (HTTP ${res.status}): ${body.slice(0, 400)}`)
}

export async function googleProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) await oauthFail('Google', 'token exchange', tokenRes)
  const { access_token } = await tokenRes.json() as { access_token: string }
  const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!meRes.ok) await oauthFail('Google', 'profile fetch', meRes)
  const me = await meRes.json() as { sub: string; email: string; name?: string; picture?: string }
  return { provider: 'google', providerId: me.sub, email: me.email, name: me.name ?? me.email, avatar: me.picture }
}

export function microsoftAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.oauth.microsoft.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    response_mode: 'query',
    state,
  })
  return `https://login.microsoftonline.com/${config.oauth.microsoft.tenant}/oauth2/v2.0/authorize?${params}`
}

export async function microsoftProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  const tokenRes = await fetch(`https://login.microsoftonline.com/${config.oauth.microsoft.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'openid email profile User.Read',
    }),
  })
  if (!tokenRes.ok) await oauthFail('Microsoft', 'token exchange', tokenRes)
  const { access_token } = await tokenRes.json() as { access_token: string }
  const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!meRes.ok) await oauthFail('Microsoft', 'profile fetch', meRes)
  const me = await meRes.json() as { id: string; displayName?: string; mail?: string; userPrincipalName?: string }
  const email = me.mail ?? me.userPrincipalName ?? ''
  return { provider: 'microsoft', providerId: me.id, email, name: me.displayName ?? email }
}
