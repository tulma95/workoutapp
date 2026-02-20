import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../types';
import prisma from '../lib/db';
import { ACHIEVEMENT_DEFS } from '../services/achievement.service';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { slug: true, unlockedAt: true, workoutId: true },
  });

  const unlockedMap = new Map(
    userAchievements.map((a) => [a.slug, { unlockedAt: a.unlockedAt, workoutId: a.workoutId }]),
  );

  const achievements = ACHIEVEMENT_DEFS.map((def) => {
    const unlocked = unlockedMap.get(def.slug);
    return {
      slug: def.slug,
      name: def.name,
      description: def.description,
      unlockedAt: unlocked ? unlocked.unlockedAt.toISOString() : null,
      workoutId: unlocked ? unlocked.workoutId : null,
    };
  });

  res.json({ achievements });
});

export default router;
