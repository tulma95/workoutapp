import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import prisma from '../lib/db';

const router = Router();

router.use(authenticate);

async function getAcceptedFriendIds(userId: number): Promise<number[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'accepted' },
        { addresseeId: userId, status: 'accepted' },
      ],
    },
  });
  return friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}

const requestSchema = z.object({
  email: z.string().email(),
});

router.post('/request', validate(requestSchema), async (req: AuthRequest, res: Response) => {
  const callerId = getUserId(req);
  const { email } = req.body;

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  if (target.id === callerId) {
    res.status(400).json({ error: { code: 'SELF_FRIEND', message: 'Cannot send friend request to yourself' } });
    return;
  }

  // Canonical ordering: requesterId < addresseeId (enforced by DB CHECK constraint)
  const requesterId = Math.min(callerId, target.id);
  const addresseeId = Math.max(callerId, target.id);

  const existing = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId, addresseeId } },
  });
  if (existing) {
    res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Friend request already exists' } });
    return;
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId, status: 'pending' },
  });

  res.status(201).json({ id: friendship.id });
});

router.get('/friends', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'accepted' },
        { addresseeId: userId, status: 'accepted' },
      ],
    },
    include: {
      requester: { select: { id: true, displayName: true } },
      addressee: { select: { id: true, displayName: true } },
    },
  });

  const friends = friendships.map((f) => {
    const friend = f.requesterId === userId ? f.addressee : f.requester;
    return { id: f.id, userId: friend.id, displayName: friend.displayName };
  });

  res.json({ friends });
});

// GET /requests must be registered BEFORE any dynamic /:id route
router.get('/requests', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);

  const requests = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'pending' },
        { addresseeId: userId, status: 'pending' },
      ],
    },
    include: {
      requester: { select: { id: true, displayName: true } },
      addressee: { select: { id: true, displayName: true } },
    },
  });

  const result = requests.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return { id: f.id, requesterId: f.requesterId, displayName: other.displayName };
  });

  res.json({ requests: result });
});

router.patch('/requests/:id/accept', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid request ID' } });
    return;
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.status !== 'pending') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend request not found' } });
    return;
  }

  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    return;
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: 'accepted' },
  });

  res.json({ id: updated.id, status: updated.status });
});

router.patch('/requests/:id/decline', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid request ID' } });
    return;
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.status !== 'pending') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friend request not found' } });
    return;
  }

  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    return;
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: 'declined' },
  });

  res.json({ id: updated.id, status: updated.status });
});

router.delete('/friends/:id', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid friendship ID' } });
    return;
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.status !== 'accepted') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Friendship not found' } });
    return;
  }

  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } });
    return;
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: 'removed' },
  });

  res.json({ id: updated.id, status: updated.status });
});

router.get('/feed', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const friendIds = await getAcceptedFriendIds(userId);

  if (friendIds.length === 0) {
    res.json({ events: [] });
    return;
  }

  const events = await prisma.feedEvent.findMany({
    where: { userId: { in: friendIds } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, displayName: true } },
    },
  });

  const result = events.map((e) => ({
    id: e.id,
    userId: e.userId,
    displayName: e.user.displayName,
    eventType: e.eventType,
    payload: e.payload,
    createdAt: e.createdAt,
  }));

  res.json({ events: result });
});

router.get('/leaderboard', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);

  const activePlan = await prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: {
      plan: {
        include: {
          days: {
            include: {
              exercises: {
                include: {
                  tmExercise: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!activePlan) {
    res.json({ exercises: [] });
    return;
  }

  // Collect unique TM exercises across all plan days
  const tmExerciseMap = new Map<number, { slug: string; name: string }>();
  for (const day of activePlan.plan.days) {
    for (const exercise of day.exercises) {
      if (!tmExerciseMap.has(exercise.tmExercise.id)) {
        tmExerciseMap.set(exercise.tmExercise.id, {
          slug: exercise.tmExercise.slug,
          name: exercise.tmExercise.name,
        });
      }
    }
  }

  if (tmExerciseMap.size === 0) {
    res.json({ exercises: [] });
    return;
  }

  const friendIds = await getAcceptedFriendIds(userId);
  const participantIds = [userId, ...friendIds];

  const participants = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, displayName: true },
  });
  const participantMap = new Map(participants.map((p) => [p.id, p.displayName]));

  const exercises = [];
  for (const [exerciseId, exerciseInfo] of tmExerciseMap) {
    const tms = await prisma.trainingMax.findMany({
      where: {
        exerciseId,
        userId: { in: participantIds },
      },
      orderBy: [{ userId: 'asc' }, { effectiveDate: 'desc' }],
    });

    // Latest TM per user (first row per userId since ordered by effectiveDate desc)
    const latestByUser = new Map<number, number>();
    for (const tm of tms) {
      if (!latestByUser.has(tm.userId)) {
        latestByUser.set(tm.userId, tm.weight.toNumber());
      }
    }

    const rankings = Array.from(latestByUser.entries())
      .map(([uid, weight]) => ({
        userId: uid,
        displayName: participantMap.get(uid) ?? 'Unknown',
        weight,
      }))
      .sort((a, b) => b.weight - a.weight);

    if (rankings.length > 0) {
      exercises.push({
        slug: exerciseInfo.slug,
        name: exerciseInfo.name,
        rankings,
      });
    }
  }

  res.json({ exercises });
});

export default router;
