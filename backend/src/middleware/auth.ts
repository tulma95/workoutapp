import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JwtPayload } from '../types';
import { logger } from '../lib/logger';
import { setUserId } from '../lib/requestContext';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.warn('Auth failed: missing or malformed Authorization header');
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin;
    setUserId(decoded.userId);
    next();
  } catch {
    logger.warn('Auth failed: invalid or expired token');
    res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  }
}
