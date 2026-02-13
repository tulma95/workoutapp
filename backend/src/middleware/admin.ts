import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { logger } from '../lib/logger';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    logger.warn('Admin access denied', { userId: req.userId, isAdmin: req.isAdmin });
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
    return;
  }
  next();
}
