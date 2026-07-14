import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifySession, SESSION_COOKIE } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined;
}

/** Populate req.user from the session cookie / bearer token (if present). */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? bearer(req);
  const payload = token ? verifySession(token) : null;
  if (payload)
    req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
  next();
}

/** Require an authenticated user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  next();
}

/** Require one of the given roles. */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!roles.includes(req.user.role)) throw new ForbiddenError('Insufficient role');
    next();
  };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Block mutating requests for signed-in viewers (anonymous local users may write). */
export function requireWrite(req: Request, _res: Response, next: NextFunction): void {
  if (MUTATING.has(req.method) && req.user && req.user.role === 'viewer') {
    throw new ForbiddenError('Viewers cannot modify data');
  }
  next();
}

/** The data owner for this request: the user id when signed in, else a shared local workspace. */
export function ownerOf(req: Request): string {
  return req.user?.id ?? 'local';
}
