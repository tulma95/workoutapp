import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId, JwtPayload } from '../types/index';
import { notificationManager } from '../services/notifications.service';
import { config } from '../config';
import { logger } from '../lib/logger';

const router = Router();

// SSE endpoint: accept token via query param (EventSource can't set custom headers)
// Falls back to standard Bearer auth middleware if no query token
function authenticateSse(req: AuthRequest, res: Response, next: NextFunction) {
  const queryToken = req.query.token as string | undefined;
  if (queryToken) {
    try {
      const decoded = jwt.verify(queryToken, config.jwtSecret) as JwtPayload;
      req.userId = decoded.userId;
      req.isAdmin = decoded.isAdmin;
      return next();
    } catch {
      logger.warn('SSE auth failed: invalid query token');
      res.status(401).json({ error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' } });
      return;
    }
  }
  authenticate(req, res, next);
}

router.get('/stream', authenticateSse, (req: AuthRequest, res) => {
  const userId = getUserId(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  notificationManager.connect(userId, res);
});

export default router;
