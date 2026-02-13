import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest, ExistingWorkoutError } from '../types';
import * as workoutService from '../services/workout.service';

const router = Router();

router.use(authenticate);

const startSchema = z.object({
  dayNumber: z.number().int().min(1),
});

router.post('/', validate(startSchema), async (req: AuthRequest, res: Response) => {
  try {
    const workout = await workoutService.startWorkout(req.userId!, req.body.dayNumber);
    res.status(201).json(workout);
  } catch (err: unknown) {
    if (err instanceof ExistingWorkoutError) {
      res.status(409).json({
        error: 'EXISTING_WORKOUT',
        workoutId: err.workoutId,
        dayNumber: err.dayNumber
      });
      return;
    }
    if (err instanceof Error) {
      if (err.message.startsWith('BAD_REQUEST:')) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message.slice(13) } });
        return;
      }
    }
    throw err;
  }
});

router.get('/current', async (req: AuthRequest, res: Response) => {
  const workout = await workoutService.getCurrentWorkout(req.userId!);
  res.json(workout);
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const result = await workoutService.getHistory(req.userId!, page, limit);
  res.json(result);
});

router.get('/calendar', async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10);

  if (!year || isNaN(year) || !month || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: { code: 'INVALID_PARAMS', message: 'Valid year and month (1-12) are required' } });
    return;
  }

  const result = await workoutService.getCalendar(req.userId!, year, month);
  res.json(result);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid workout ID' } });
    return;
  }
  const workout = await workoutService.getWorkout(id, req.userId!);
  if (!workout) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workout not found' } });
    return;
  }
  res.json(workout);
});

const logSetSchema = z.object({
  actualReps: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});

router.patch('/:id/sets/:setId', validate(logSetSchema), async (req: AuthRequest, res: Response) => {
  const setId = parseInt(req.params.setId as string, 10);
  if (isNaN(setId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid set ID' } });
    return;
  }
  const result = await workoutService.logSet(setId, req.userId!, req.body);
  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Set not found' } });
    return;
  }
  res.json(result);
});

router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid workout ID' } });
    return;
  }
  const result = await workoutService.completeWorkout(id, req.userId!);
  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workout not found' } });
    return;
  }
  res.json(result);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid workout ID' } });
    return;
  }
  try {
    const result = await workoutService.cancelWorkout(id, req.userId!);
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workout not found' } });
      return;
    }
    res.status(200).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('CONFLICT:')) {
      res.status(409).json({ error: { code: 'CONFLICT', message: err.message.slice(10) } });
      return;
    }
    throw err;
  }
});

export default router;
