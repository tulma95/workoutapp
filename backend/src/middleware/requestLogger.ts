import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { getRequestContext } from '../lib/requestContext';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Log request start (skip password fields for auth routes)
  if (req.body && Object.keys(req.body).length > 0) {
    const body = req.path.startsWith('/auth') || req.path.startsWith('/api/auth')
      ? { ...req.body, password: '[REDACTED]' }
      : req.body;
    logger.debug('Incoming request', { body });
  } else {
    logger.debug('Incoming request');
  }

  res.on('finish', () => {
    const ctx = getRequestContext();
    const durationMs = ctx ? Date.now() - ctx.startTime : undefined;
    const extra: Record<string, unknown> = { statusCode: res.statusCode };
    if (durationMs !== undefined) {
      extra.durationMs = durationMs;
    }

    if (res.statusCode >= 500) {
      logger.error('Request completed', extra);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', extra);
    } else {
      logger.info('Request completed', extra);
    }
  });

  next();
}
