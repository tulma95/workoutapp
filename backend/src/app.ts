import path from 'path';
import express from 'express';
import cors from 'cors';
import prisma from './lib/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import trainingMaxRoutes from './routes/trainingMaxes';
import workoutRoutes from './routes/workouts';
import planRoutes from './routes/plans';
import adminExerciseRoutes from './routes/admin/exercises';
import adminPlanRoutes from './routes/admin/plans';
import { errorHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { requestLogger } from './middleware/requestLogger';
import { authenticate } from './middleware/auth';
import { config } from './config';
import { logger } from './lib/logger';
import type { AuthRequest } from './types';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestContext);
app.use(requestLogger);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.debug('Health check passed');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    logger.error('Health check failed: database disconnected');
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/training-maxes', trainingMaxRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/admin/exercises', adminExerciseRoutes);
app.use('/api/admin/plans', adminPlanRoutes);

// Test/dev-only endpoint to promote current user to admin
if (config.nodeEnv === 'test' || config.nodeEnv === 'development') {
  app.post('/api/dev/promote-admin', authenticate, async (req: AuthRequest, res) => {
    await prisma.user.update({
      where: { id: req.userId },
      data: { isAdmin: true },
    });
    res.json({ ok: true });
  });
}

// Serve frontend static files and handle SPA routing
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(errorHandler);

export default app;
