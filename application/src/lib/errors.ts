// Global HTTP error classes. Throw these anywhere — the central error handler
// turns them into the right status code + JSON body.

export class AppError extends Error {
  readonly statusCode: number;
  /** Whether the message is safe to send to the client (4xx) vs hidden in prod (5xx) */
  readonly expose: boolean;

  constructor(statusCode: number, message: string, expose = statusCode < 500) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.expose = expose;
    Error.captureStackTrace?.(this, new.target);
  }
}

// ── 4xx — client errors ───────────────────────────────────────────────────────
export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}
export class PaymentRequiredError extends AppError {
  constructor(message = 'Payment Required') {
    super(402, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(404, message);
  }
}
export class MethodNotAllowedError extends AppError {
  constructor(message = 'Method Not Allowed') {
    super(405, message);
  }
}
export class NotAcceptableError extends AppError {
  constructor(message = 'Not Acceptable') {
    super(406, message);
  }
}
export class RequestTimeoutError extends AppError {
  constructor(message = 'Request Timeout') {
    super(408, message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}
export class GoneError extends AppError {
  constructor(message = 'Gone') {
    super(410, message);
  }
}
export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload Too Large') {
    super(413, message);
  }
}
export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported Media Type') {
    super(415, message);
  }
}
export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity') {
    super(422, message);
  }
}
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests') {
    super(429, message);
  }
}

// ── 5xx — server errors ───────────────────────────────────────────────────────
export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(500, message, false);
  }
}
export class NotImplementedError extends AppError {
  constructor(message = 'Not Implemented') {
    super(501, message);
  }
}
export class BadGatewayError extends AppError {
  constructor(message = 'Bad Gateway') {
    super(502, message);
  }
}
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable') {
    super(503, message);
  }
}
export class GatewayTimeoutError extends AppError {
  constructor(message = 'Gateway Timeout') {
    super(504, message);
  }
}

// Wrap a route handler so rejected promises (and thrown errors) reach the error
// handler. Works for both sync and async handlers.
import type { Request, Response, NextFunction, RequestHandler } from 'express';
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
