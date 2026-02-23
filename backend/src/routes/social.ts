import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AuthRequest, getUserId } from '../types';
import prisma from '../lib/db';
import { calculateStreak } from '../lib/streak';
import { notificationManager } from '../services/notifications.service';
import { pushService } from '../services/push.service';

const router = Router();

router.use(authenticate);

async function getStreaksForUsers(userIds: number[]): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();

  const workouts = await prisma.workout.findMany({
    where: {
      userId: { in: userIds },
      status: 'completed',
      completedAt: { not: null },
    },
    select: { userId: true, completedAt: true },
  });

  const datesByUser = new Map<number, string[]>();
  for (const w of workouts) {
    const dateStr = (w.completedAt as Date).toISOString().slice(0, 10);
    const existing = datesByUser.get(w.userId);
    if (existing) {
      existing.push(dateStr);
    } else {
      datesByUser.set(w.userId, [dateStr]);
    }
  }

  const streakMap = new Map<number, number>();
  for (const userId of userIds) {
    const dates = datesByUser.get(userId) ?? [];
    streakMap.set(userId, calculateStreak(dates));
  }

  return streakMap;
}

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
  email: z.string().email().optional(),
  username: z.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(30).optional(),
});

const reactSchema = z.object({
  emoji: z.enum(['🔥', '👏', '💀', '💪', '🤙']),
});

const commentSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(500)
    .transform((s) => s.trim())
    .refine((s) => s.length >= 1, { message: 'Comment cannot be empty after trimming' }),
});

router.post('/request', validate(requestSchema), async (req: AuthRequest, res: Response) => {
  const callerId = getUserId(req);
  const { email, username } = req.body as { email?: string; username?: string };

  if (!email && !username) {
    res.status(400).json({ error: { code: 'MISSING_FIELD', message: 'Either email or username is required' } });
    return;
  }
  if (email && username) {
    res.status(400).json({ error: { code: 'AMBIGUOUS_FIELD', message: 'Provide either email or username, not both' } });
    return;
  }

  const target = username
    ? await prisma.user.findUnique({ where: { username } })
    : await prisma.user.findUnique({ where: { email } });
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
    const sender = await prisma.user.findUnique({ where: { id: callerId }, select: { username: true } });
    const senderUsername = sender?.username ?? 'Someone';
    notificationManager.notifyUser(target.id, {
      type: 'friend_request_received',
      message: `${senderUsername} sent you a friend request`,
    });
    void pushService.sendToUser(target.id, JSON.stringify({
      type: 'friend_request_received',
      message: `${senderUsername} sent you a friend request`,
    }));
    res.status(201).json({ id: friendship.id });
    return;
  }

  const sender = await prisma.user.findUnique({ where: { id: callerId }, select: { username: true } });
  const senderUsername = sender?.username ?? 'Someone';
  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId, initiatorId: callerId, status: 'pending' },
  });
  notificationManager.notifyUser(target.id, {
    type: 'friend_request_received',
    message: `${senderUsername} sent you a friend request`,
  });
  void pushService.sendToUser(target.id, JSON.stringify({
    type: 'friend_request_received',
    message: `${senderUsername} sent you a friend request`,
  }));

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
      requester: { select: { id: true, username: true } },
      addressee: { select: { id: true, username: true } },
    },
  });

  const friends = friendships.map((f) => {
    const friend = f.requesterId === userId ? f.addressee : f.requester;
    return { id: f.id, userId: friend.id, username: friend.username };
  });

  const friendUserIds = friends.map((f) => f.userId);
  const streakMap = await getStreaksForUsers(friendUserIds);

  const friendsWithStreak = friends.map((f) => ({
    ...f,
    streak: streakMap.get(f.userId) ?? 0,
  }));

  res.json({ friends: friendsWithStreak });
});

// GET /search must be registered BEFORE any dynamic /:id route
router.get('/search', async (req: AuthRequest, res: Response) => {
  const callerId = getUserId(req);
  const q = req.query.q as string | undefined;

  if (!q || q.length < 1) {
    res.status(400).json({ error: { code: 'MISSING_QUERY', message: 'Query parameter q is required' } });
    return;
  }

  // Find all users with pending or accepted friendship with caller (both directions)
  const activeFriendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: callerId, status: { in: ['pending', 'accepted'] } },
        { addresseeId: callerId, status: { in: ['pending', 'accepted'] } },
      ],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const excludedIds = new Set<number>([callerId]);
  for (const f of activeFriendships) {
    excludedIds.add(f.requesterId);
    excludedIds.add(f.addresseeId);
  }

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: 'insensitive' },
      id: { notIn: Array.from(excludedIds) },
    },
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
    take: 10,
  });

  res.json({ users });
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
      requester: { select: { id: true, username: true } },
      addressee: { select: { id: true, username: true } },
    },
  });

  const result = requests.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return { id: f.id, requesterId: f.requesterId, username: other.username };
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

  if (friendship.initiatorId != null) {
    const acceptor = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const acceptorUsername = acceptor?.username ?? 'Someone';
    notificationManager.notifyUser(friendship.initiatorId, {
      type: 'friend_request_accepted',
      message: `${acceptorUsername} accepted your friend request`,
    });
    void pushService.sendToUser(friendship.initiatorId, JSON.stringify({
      type: 'friend_request_accepted',
      message: `${acceptorUsername} accepted your friend request`,
    }));
  }

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

  const events = await prisma.feedEvent.findMany({
    where: { userId: { in: [userId, ...friendIds] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, username: true } },
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

  const uniqueUserIds = [...new Set(events.map((e) => e.userId))];
  const streakMap = await getStreaksForUsers(uniqueUserIds);

  const commentCounts = await prisma.feedEventComment.groupBy({
    by: ['feedEventId'],
    where: { feedEventId: { in: eventIds } },
    _count: { _all: true },
  });
  const commentCountMap = new Map<number, number>();
  for (const c of commentCounts) {
    commentCountMap.set(c.feedEventId, c._count._all);
  }

  // Batch-fetch all comments for visible events, then slice to last 2 per event in memory
  const allComments = await prisma.feedEventComment.findMany({
    where: { feedEventId: { in: eventIds } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, username: true } } },
  });
  const commentsMap = new Map<number, typeof allComments>();
  for (const c of allComments) {
    const existing = commentsMap.get(c.feedEventId);
    if (existing) {
      existing.push(c);
    } else {
      commentsMap.set(c.feedEventId, [c]);
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

    const latestComments = (commentsMap.get(e.id) ?? []).slice(-2).map((c) => ({
      id: c.id,
      feedEventId: c.feedEventId,
      userId: c.userId,
      username: c.user.username,
      text: c.text,
      createdAt: c.createdAt,
    }));

    return {
      id: e.id,
      userId: e.userId,
      username: e.user.username,
      eventType: e.eventType,
      payload: e.payload,
      createdAt: e.createdAt,
      reactions,
      streak: streakMap.get(e.userId) ?? 0,
      commentCount: commentCountMap.get(e.id) ?? 0,
      latestComments,
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
  if (userId !== event.userId && !friendIds.includes(event.userId)) {
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
  const mode = req.query.mode as string | undefined;

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
    select: { id: true, username: true },
  });
  const participantMap = new Map(participants.map((p) => [p.id, p.username]));

  if (mode === 'e1rm') {
    // Query completed AMRAP sets for all participants
    const amrapSets = await prisma.workoutSet.findMany({
      where: {
        workout: {
          userId: { in: participantIds },
          status: 'completed',
        },
        isAmrap: true,
        completed: true,
        actualReps: { gt: 0 },
        exerciseId: { in: Array.from(tmExerciseMap.keys()) },
      },
      select: {
        exerciseId: true,
        prescribedWeight: true,
        actualReps: true,
        workout: { select: { userId: true } },
      },
    });

    // Group by exerciseId -> userId, keep max e1RM per user
    const e1rmByExercise = new Map<number, Map<number, number>>();
    for (const set of amrapSets) {
      const reps = set.actualReps as number;
      const weight = set.prescribedWeight.toNumber();
      const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);
      const setUserId = set.workout.userId;

      if (!e1rmByExercise.has(set.exerciseId)) {
        e1rmByExercise.set(set.exerciseId, new Map());
      }
      const byUser = e1rmByExercise.get(set.exerciseId)!;
      const existing = byUser.get(setUserId);
      if (existing === undefined || e1rm > existing) {
        byUser.set(setUserId, e1rm);
      }
    }

    const exercises = [];
    for (const [exerciseId, exerciseInfo] of tmExerciseMap) {
      const bestByUser = e1rmByExercise.get(exerciseId) ?? new Map<number, number>();

      const rankings = Array.from(bestByUser.entries())
        .map(([uid, weight]) => ({
          userId: uid,
          username: participantMap.get(uid) ?? 'Unknown',
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
    return;
  }

  // Default TM leaderboard
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
        username: participantMap.get(uid) ?? 'Unknown',
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

router.post('/feed/:eventId/comments', validate(commentSchema), async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    return;
  }

  const { text } = req.body as { text: string };

  const event = await prisma.feedEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feed event not found' } });
    return;
  }

  const friendIds = await getAcceptedFriendIds(userId);
  if (userId !== event.userId && !friendIds.includes(event.userId)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a friend of the event owner' } });
    return;
  }

  const comment = await prisma.feedEventComment.create({
    data: { feedEventId: eventId, userId, text },
  });

  if (userId !== event.userId) {
    const commenter = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const commenterUsername = commenter?.username ?? 'Someone';
    notificationManager.notifyUser(event.userId, {
      type: 'comment_received',
      message: `${commenterUsername} commented on your activity`,
    });
    void pushService.sendToUser(
      event.userId,
      JSON.stringify({ type: 'comment_received', message: `${commenterUsername} commented on your activity` }),
    );
  }

  res.status(201).json({
    id: comment.id,
    feedEventId: comment.feedEventId,
    userId: comment.userId,
    text: comment.text,
    createdAt: comment.createdAt,
  });
});

router.get('/feed/:eventId/comments', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const eventId = parseInt(req.params.eventId as string, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid event ID' } });
    return;
  }

  const event = await prisma.feedEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feed event not found' } });
    return;
  }

  const friendIds = await getAcceptedFriendIds(userId);
  if (userId !== event.userId && !friendIds.includes(event.userId)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not a friend of the event owner' } });
    return;
  }

  const comments = await prisma.feedEventComment.findMany({
    where: { feedEventId: eventId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, username: true } } },
  });

  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      feedEventId: c.feedEventId,
      userId: c.userId,
      username: c.user.username,
      text: c.text,
      createdAt: c.createdAt,
    })),
  });
});

router.delete('/feed/:eventId/comments/:commentId', async (req: AuthRequest, res: Response) => {
  const userId = getUserId(req);
  const eventId = parseInt(req.params.eventId as string, 10);
  const commentId = parseInt(req.params.commentId as string, 10);

  if (isNaN(eventId) || isNaN(commentId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    return;
  }

  const event = await prisma.feedEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feed event not found' } });
    return;
  }

  const comment = await prisma.feedEventComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.feedEventId !== eventId) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Comment not found' } });
    return;
  }

  const isAuthor = userId === comment.userId;
  const isEventOwner = userId === event.userId;
  if (!isAuthor && !isEventOwner) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to delete this comment' } });
    return;
  }

  await prisma.feedEventComment.delete({ where: { id: commentId } });

  res.json({ id: commentId });
});

export default router;
