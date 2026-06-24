import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Honor a status carried on the error (body-parser's 413, http-errors, etc.).
  // Anything without a valid 4xx/5xx status is treated as an unexpected 500.
  const carried = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  const httpStatus =
    typeof carried === 'number' && carried >= 400 && carried < 600 ? carried : 500;
  const isClientError = httpStatus < 500;

  if (isClientError) {
    logger.warn('Request rejected', { error: err.message, status: httpStatus });
  } else {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
  }

  const response: { error: { code: string; message: string; stack?: string } } = {
    error: {
      code: isClientError ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
      // Client errors carry safe, actionable messages; server errors are masked in production.
      message:
        isClientError || config.nodeEnv === 'development' ? err.message : 'Internal server error',
    },
  };

  if (config.nodeEnv === 'development') {
    response.error.stack = err.stack;
  }

  res.status(httpStatus).json(response);
}
