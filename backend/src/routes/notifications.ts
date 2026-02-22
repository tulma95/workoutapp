import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest, getUserId, JwtPayload } from '../types/index';
import { notificationManager } from '../services/notifications.service';
import { pushService } from '../services/push.service';
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

// Public: return VAPID public key for client-side push subscription
router.get('/public-key', (_req, res) => {
  res.json({ publicKey: config.vapidPublicKey });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// Store push subscription for authenticated user
router.post('/subscribe', authenticate, validate(subscribeSchema), async (req: AuthRequest, res) => {
  const userId = getUserId(req);
  const { endpoint, keys } = req.body as z.infer<typeof subscribeSchema>;
  await pushService.subscribe(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
  res.status(201).json({ ok: true });
});

// Remove push subscription for authenticated user
router.delete('/subscribe', authenticate, validate(unsubscribeSchema), async (req: AuthRequest, res) => {
  const userId = getUserId(req);
  const { endpoint } = req.body as z.infer<typeof unsubscribeSchema>;

  const existing = await import('../lib/db').then((m) =>
    m.default.pushSubscription.findFirst({ where: { userId, endpoint } }),
  );

  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
    return;
  }

  await pushService.unsubscribe(userId, endpoint);
  res.json({ ok: true });
});

export default router;
