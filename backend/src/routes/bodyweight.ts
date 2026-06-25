import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import { parseIntParam } from '../lib/routeHelpers';
import {
  logBodyweight,
  getBodyweightHistory,
  deleteBodyweightEntry,
} from '../services/bodyweight.service';

const router = Router();

router.use(authenticate);

const logBodyweightSchema = z.object({
  weight: z.number().positive().max(999),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const entries = await getBodyweightHistory(getUserId(req));
  res.json({ entries });
});

router.post('/', validate(logBodyweightSchema), async (req: AuthRequest, res: Response) => {
  const { weight } = req.body as { weight: number };
  const entry = await logBodyweight(getUserId(req), weight);
  res.status(201).json(entry);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseIntParam(res, req.params.id as string, 'entry ID');
  if (id === null) return;
  const deleted = await deleteBodyweightEntry(getUserId(req), id);
  if (!deleted) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entry not found' } });
    return;
  }
  res.status(204).send();
});

export default router;
