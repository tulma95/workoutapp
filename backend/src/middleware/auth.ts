import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JwtPayload } from '../types';
import { logger } from '../lib/logger';
import { setUserId } from '../lib/requestContext';
import prisma from '../lib/db';

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.warn('Auth failed: missing or malformed Authorization header');
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
    return;
  }

  const token = header.slice(7);
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    logger.warn('Auth failed: invalid or expired token');
    res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
    return;
  }

  // Verify tokenVersion matches the current value in DB so that old tokens
  // issued before a password change are rejected.
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { tokenVersion: true },
  });
  if (!user || user.tokenVersion !== decoded.tokenVersion) {
    logger.warn('Auth failed: token version mismatch or user not found', { userId: decoded.userId });
    res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
    return;
  }

  req.userId = decoded.userId;
  req.isAdmin = decoded.isAdmin;
  setUserId(decoded.userId);
  next();
}
