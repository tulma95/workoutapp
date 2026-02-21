import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types/index';
import { notificationManager } from '../services/notifications.service';

const router = Router();

router.get('/stream', authenticate, (req: AuthRequest, res) => {
  const userId = getUserId(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  notificationManager.connect(userId, res);
});

export default router;
