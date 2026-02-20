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

const reactSchema = z.object({
  emoji: z.enum(['🔥', '👏', '💀', '💪', '🤙']),
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
    if (existing.status === 'pending' || existing.status === 'accepted') {
      res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Friend request already exists' } });
      return;
    }
    // Reset a previously declined or removed friendship to pending
    const friendship = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'pending', initiatorId: callerId },
    });
    res.status(201).json({ id: friendship.id });
    return;
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId, initiatorId: callerId, status: 'pending' },
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

  // Only return pending requests where the current user is the recipient (not the initiator)
  const requests = await prisma.friendship.findMany({
    where: {
      status: 'pending',
      OR: [
        { requesterId: userId },
        { addresseeId: userId },
      ],
      NOT: { initiatorId: userId },
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

  if (friendship.initiatorId === userId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot accept your own friend request' } });
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

  if (friendship.initiatorId === userId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot decline your own friend request' } });
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

  const eventIds = events.map((e) => e.id);

  const allReactions = await prisma.feedEventReaction.findMany({
    where: { feedEventId: { in: eventIds } },
  });

  // Group reactions by feedEventId then emoji
  type ReactionGroup = { count: number; reactedByMe: boolean };
  const reactionMap = new Map<string, ReactionGroup>();
  for (const r of allReactions) {
    const key = `${r.feedEventId}:${r.emoji}`;
    const existing = reactionMap.get(key);
    if (existing) {
      existing.count++;
      if (r.userId === userId) existing.reactedByMe = true;
    } else {
      reactionMap.set(key, { count: 1, reactedByMe: r.userId === userId });
    }
  }

  const result = events.map((e) => {
    // Collect all unique emojis for this event from the already-built reactionMap
    const prefix = `${e.id}:`;
    const reactions = Array.from(reactionMap.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, group]) => ({
        emoji: key.slice(prefix.length),
        count: group.count,
        reactedByMe: group.reactedByMe,
      }));

    return {
      id: e.id,
      userId: e.userId,
      displayName: e.user.displayName,
      eventType: e.eventType,
      payload: e.payload,
      createdAt: e.createdAt,
      reactions,
    };
  });

  res.json({ events: result });
});

router.post('/feed/:eventId/react', validate(reactSchema), async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    return;
  }

  const { emoji } = req.body as { emoji: string };

  const event = await prisma.feedEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feed event not found' } });
    return;
  }

  const friendIds = await getAcceptedFriendIds(userId);
  if (!friendIds.includes(event.userId)) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feed event not found' } });
    return;
  }

  const existing = await prisma.feedEventReaction.findUnique({
    where: { feedEventId_userId_emoji: { feedEventId: eventId, userId, emoji } },
  });

  let reacted: boolean;
  if (existing) {
    await prisma.feedEventReaction.delete({ where: { id: existing.id } });
    reacted = false;
  } else {
    await prisma.feedEventReaction.create({ data: { feedEventId: eventId, userId, emoji } });
    reacted = true;
  }

  const count = await prisma.feedEventReaction.count({
    where: { feedEventId: eventId, emoji },
  });

  res.json({ reacted, count });
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

  // Fetch all TMs in one query, then group in memory
  const allTMs = await prisma.trainingMax.findMany({
    where: {
      exerciseId: { in: Array.from(tmExerciseMap.keys()) },
      userId: { in: participantIds },
    },
    orderBy: [{ exerciseId: 'asc' }, { userId: 'asc' }, { effectiveDate: 'desc' }],
  });

  // Group by exerciseId, then pick latest per user
  const tmsByExercise = new Map<number, Map<number, number>>();
  for (const tm of allTMs) {
    if (!tmsByExercise.has(tm.exerciseId)) {
      tmsByExercise.set(tm.exerciseId, new Map());
    }
    const byUser = tmsByExercise.get(tm.exerciseId)!;
    if (!byUser.has(tm.userId)) {
      byUser.set(tm.userId, tm.weight.toNumber());
    }
  }

  const exercises = [];
  for (const [exerciseId, exerciseInfo] of tmExerciseMap) {
    const latestByUser = tmsByExercise.get(exerciseId) ?? new Map<number, number>();

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
