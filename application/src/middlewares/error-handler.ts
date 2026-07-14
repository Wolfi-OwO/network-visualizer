import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { isProduction } from '../config/index.js';
import { AppError, NotFoundError } from '../lib/errors.js';

// Catch-all for unmatched routes -> forwards a 404 to the error handler.
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

// Centralised error handler — maps AppError instances to their status code and
// keeps internal (5xx) details out of client responses in production.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(`${err.statusCode} ${err.name}`, err);
    else logger.warn(`${err.statusCode} ${err.name}: ${err.message}`);
    res.status(err.statusCode).json({
      error: err.name,
      message: err.expose || !isProduction ? err.message : 'Internal Server Error',
      statusCode: err.statusCode,
    });
    return;
  }

  // Anything unexpected -> 500
  logger.error('Unhandled error', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: 'InternalServerError',
    message: isProduction ? 'Internal Server Error' : message,
    statusCode: 500,
  });
}
