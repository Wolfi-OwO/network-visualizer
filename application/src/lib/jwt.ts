import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtTtl as jwt.SignOptions['expiresIn'],
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'netviz_token';
