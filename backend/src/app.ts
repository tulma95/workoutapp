import express from 'express';
import cors from 'cors';
import prisma from './lib/db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import trainingMaxRoutes from './routes/trainingMaxes';
import workoutRoutes from './routes/workouts';
import { errorHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './lib/logger';

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

app.use(errorHandler);

export default app;
