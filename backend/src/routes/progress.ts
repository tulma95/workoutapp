import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types/index';
import * as progressService from '../services/progress.service';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const result = await progressService.getProgress(getUserId(req));
  res.json(result);
});

export default router;
