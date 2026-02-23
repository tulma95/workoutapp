import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import prisma from '../lib/db';
import { parseIntParam } from '../lib/routeHelpers';
import { PLAN_DETAIL_INCLUDE } from '../lib/planIncludes';

const router = Router();

router.use(authenticate);

// GET /api/plans — list available plans
router.get('/', async (_req: AuthRequest, res: Response) => {
  const plans = await prisma.workoutPlan.findMany({
    where: {
      isPublic: true,
      archivedAt: null,
    },
    include: {
      days: {
        include: {
          exercises: {
            include: {
              exercise: true,
              tmExercise: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { dayNumber: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(plans);
});

// GET /api/plans/current — get user's active plan
router.get('/current', async (req: AuthRequest, res: Response) => {
  const userPlan = await prisma.userPlan.findFirst({
    where: {
      userId: getUserId(req),
      isActive: true,
    },
    include: {
      plan: {
        include: PLAN_DETAIL_INCLUDE,
      },
    },
  });

  if (!userPlan) {
    res.json(null);
    return;
  }

  res.json(userPlan.plan);
});

// GET /api/plans/:id — get plan details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const id = parseIntParam(res, req.params.id as string, 'plan ID');
  if (id === null) return;

  const plan = await prisma.workoutPlan.findFirst({
    where: {
      id,
      isPublic: true,
      archivedAt: null,
    },
    include: PLAN_DETAIL_INCLUDE,
  });

  if (!plan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  res.json(plan);
});

// POST /api/plans/:id/subscribe — subscribe to a plan
router.post('/:id/subscribe', async (req: AuthRequest, res: Response) => {
  const id = parseIntParam(res, req.params.id as string, 'plan ID');
  if (id === null) return;

  // Check if plan exists and is public
  const plan = await prisma.workoutPlan.findFirst({
    where: {
      id,
      isPublic: true,
      archivedAt: null,
    },
    include: {
      days: {
        include: {
          exercises: {
            select: {
              tmExerciseId: true,
            },
          },
        },
      },
    },
  });

  if (!plan) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    return;
  }

  // Get unique TM exercises required by the plan
  const requiredExerciseIds = Array.from(
    new Set(
      plan.days.flatMap(day =>
        day.exercises.map(ex => ex.tmExerciseId)
      )
    )
  );

  // Get user's existing training maxes
  const existingTMs = await prisma.trainingMax.findMany({
    where: {
      userId: getUserId(req),
      exerciseId: { in: requiredExerciseIds },
    },
    distinct: ['exerciseId'],
    orderBy: {
      effectiveDate: 'desc',
    },
  });

  const existingExerciseIds = existingTMs.map(tm => tm.exerciseId).filter((id): id is number => id !== null);
  const missingExerciseIds = requiredExerciseIds.filter(id => !existingExerciseIds.includes(id));

  // Get exercise details for required and missing TMs
  const requiredExercises = await prisma.exercise.findMany({
    where: {
      id: { in: requiredExerciseIds },
    },
  });

  const missingTMs = await prisma.exercise.findMany({
    where: {
      id: { in: missingExerciseIds },
    },
  });

  // Subscribe to the plan
  const userPlan = await prisma.$transaction(async (tx) => {
    // Deactivate previous active plans
    await tx.userPlan.updateMany({
      where: {
        userId: getUserId(req),
        isActive: true,
      },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    // Discard any in-progress workout from the old plan
    await tx.workout.updateMany({
      where: {
        userId: getUserId(req),
        status: 'in_progress',
      },
      data: {
        status: 'discarded',
      },
    });

    // Create new subscription
    const newUserPlan = await tx.userPlan.create({
      data: {
        userId: getUserId(req),
        planId: id,
        isActive: true,
      },
      include: {
        plan: true,
      },
    });

    // Emit plan_switched feed event
    await tx.feedEvent.create({
      data: {
        userId: getUserId(req),
        eventType: 'plan_switched',
        payload: { planId: plan.id, planName: plan.name, planSlug: plan.slug },
      },
    });

    return newUserPlan;
  });

  res.json({
    userPlan,
    requiredExercises,
    missingTMs,
  });
});

export default router;
