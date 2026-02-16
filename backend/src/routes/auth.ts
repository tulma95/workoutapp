import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as authService from '../services/auth.service';
import { logger } from '../lib/logger';

const router = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { password: _pw, ...safeBody } = req.body;
    logger.debug('Register request', { body: safeBody });
    const { email, password, displayName } = req.body;
    const result = await authService.register(email, password, displayName);
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
      });
      return;
    }
    throw err;
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    logger.debug('Login request', { body: { email: req.body.email } });
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Invalid email or password') {
      res.status(401).json({
        error: { code: 'AUTH_FAILED', message: 'Invalid email or password' },
      });
      return;
    }
    throw err;
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshTokens(refreshToken);
    res.status(200).json(result);
  } catch {
    res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token' },
    });
  }
});

export default router;
