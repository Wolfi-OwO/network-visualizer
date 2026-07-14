import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// Rate limiting only applies in production (avoids tripping during tests/dev,
// which fire many requests quickly).
const skip = () => config.nodeEnv !== 'production';

/** General API limiter. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

/** Stricter limiter for auth endpoints (slows brute-force / credential stuffing). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});
