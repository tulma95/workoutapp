import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('Social API', () => {
  let tokenA: string;
  let userIdA: number;
  let tokenB: string;
  let userIdB: number;
  let emailB: string;

  beforeAll(async () => {
    // Register user A
    const resA = await request(app).post('/api/auth/register').send({
      email: `social-a-${uid}@example.com`,
      password: 'password123',
      displayName: 'Social User A',
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // Register user B
    emailB = `social-b-${uid}@example.com`;
    const resB = await request(app).post('/api/auth/register').send({
      email: emailB,
      password: 'password123',
      displayName: 'Social User B',
    });
    tokenB = resB.body.accessToken;
    userIdB = resB.body.user.id;
  });

  describe('Authentication required', () => {
    it('POST /api/social/request requires auth', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .send({ email: emailB });
      expect(res.status).toBe(401);
    });

    it('GET /api/social/friends requires auth', async () => {
      const res = await request(app).get('/api/social/friends');
      expect(res.status).toBe(401);
    });

    it('GET /api/social/requests requires auth', async () => {
      const res = await request(app).get('/api/social/requests');
      expect(res.status).toBe(401);
    });

    it('GET /api/social/feed requires auth', async () => {
      const res = await request(app).get('/api/social/feed');
      expect(res.status).toBe(401);
    });

    it('GET /api/social/leaderboard requires auth', async () => {
      const res = await request(app).get('/api/social/leaderboard');
      expect(res.status).toBe(401);
    });
  });

  describe('Friend request flow', () => {
    let friendshipId: number;

    it('returns 404 when target email not found', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: `nonexistent-${uid}@example.com` });
      expect(res.status).toBe(404);
    });

    it('returns 400 when trying to friend yourself', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: `social-a-${uid}@example.com` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_FRIEND');
    });

    it('sends a friend request by email', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: emailB });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      friendshipId = res.body.id;
    });

    it('returns 409 when duplicate request sent in same direction', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: emailB });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_EXISTS');
    });

    it('returns 409 when duplicate request sent in reverse direction', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ email: `social-a-${uid}@example.com` });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_EXISTS');
    });

    it('user B sees the pending request in GET /requests', async () => {
      const res = await request(app)
        .get('/api/social/requests')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(1);
      expect(res.body.requests[0].id).toBe(friendshipId);
      expect(res.body.requests[0].displayName).toBe('Social User A');
    });

    it('friends list is empty before acceptance', async () => {
      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.friends).toHaveLength(0);
    });

    it('user A (sender) cannot accept their own request', async () => {
      const res = await request(app)
        .patch(`/api/social/requests/${friendshipId}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('user B can accept the request', async () => {
      const res = await request(app)
        .patch(`/api/social/requests/${friendshipId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');
    });

    it('friendship appears in friends list after acceptance', async () => {
      const resA = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resA.status).toBe(200);
      expect(resA.body.friends).toHaveLength(1);
      expect(resA.body.friends[0].displayName).toBe('Social User B');
      expect(resA.body.friends[0].userId).toBe(userIdB);

      const resB = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.body.friends).toHaveLength(1);
      expect(resB.body.friends[0].displayName).toBe('Social User A');
      expect(resB.body.friends[0].userId).toBe(userIdA);
    });

    it('no longer shows in pending requests after acceptance', async () => {
      const res = await request(app)
        .get('/api/social/requests')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(0);
    });

    it('user A can remove the friend', async () => {
      const res = await request(app)
        .delete(`/api/social/friends/${friendshipId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('removed');
    });

    it('friends list is empty after removal', async () => {
      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.friends).toHaveLength(0);
    });
  });

  describe('Decline flow', () => {
    it('can re-send a request after removal', async () => {
      const emailD = `social-d-${uid}@example.com`;
      const resD = await request(app).post('/api/auth/register').send({
        email: emailD,
        password: 'password123',
        displayName: 'Social User D',
      });
      const tokenD = resD.body.accessToken;

      // A sends to D, D accepts, A removes
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: emailD });
      const fid = reqRes.body.id;
      await request(app).patch(`/api/social/requests/${fid}/accept`).set('Authorization', `Bearer ${tokenD}`);
      await request(app).delete(`/api/social/friends/${fid}`).set('Authorization', `Bearer ${tokenA}`);

      // A can re-send (resets to pending instead of 409)
      const reRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: emailD });
      expect(reRes.status).toBe(201);

      // D sees the incoming request; A does not see it in their own GET /requests
      const dReqs = await request(app).get('/api/social/requests').set('Authorization', `Bearer ${tokenD}`);
      expect(dReqs.body.requests).toHaveLength(1);
      const aReqs = await request(app).get('/api/social/requests').set('Authorization', `Bearer ${tokenA}`);
      expect(aReqs.body.requests.some((r: { displayName: string }) => r.displayName === 'Social User D')).toBe(false);
    });

    it('user can decline a pending request', async () => {
      // Register user C for this test
      const emailC = `social-c-${uid}@example.com`;
      const resC = await request(app).post('/api/auth/register').send({
        email: emailC,
        password: 'password123',
        displayName: 'Social User C',
      });
      const tokenC = resC.body.accessToken;

      // A sends request to C
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: emailC });
      expect(reqRes.status).toBe(201);
      const reqId = reqRes.body.id;

      // C declines
      const declineRes = await request(app)
        .patch(`/api/social/requests/${reqId}/decline`)
        .set('Authorization', `Bearer ${tokenC}`);
      expect(declineRes.status).toBe(200);
      expect(declineRes.body.status).toBe('declined');

      // C's friends list is still empty
      const friendsRes = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenC}`);
      expect(friendsRes.body.friends).toHaveLength(0);
    });
  });

  describe('Feed', () => {
    let tokenFeedA: string;
    let userIdFeedA: number;
    let tokenFeedB: string;
    let userIdFeedB: number;
    let tokenFeedC: string;

    beforeAll(async () => {
      const uidFeed = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `feed-a-${uidFeed}@example.com`,
        password: 'password123',
        displayName: 'Feed User A',
      });
      tokenFeedA = resA.body.accessToken;
      userIdFeedA = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `feed-b-${uidFeed}@example.com`,
        password: 'password123',
        displayName: 'Feed User B',
      });
      tokenFeedB = resB.body.accessToken;
      userIdFeedB = resB.body.user.id;

      // Register user C (not a friend)
      const resC = await request(app).post('/api/auth/register').send({
        email: `feed-c-${uidFeed}@example.com`,
        password: 'password123',
        displayName: 'Feed User C',
      });
      tokenFeedC = resC.body.accessToken;
      const userIdFeedC = resC.body.user.id;

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenFeedA}`)
        .send({ email: `feed-b-${uidFeed}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenFeedB}`);

      // Create feed events for B (friend of A) and C (not friend of A)
      await prisma.feedEvent.createMany({
        data: [
          {
            userId: userIdFeedB,
            eventType: 'workout_completed',
            payload: { workoutId: 999, dayNumber: 1 },
          },
          {
            userId: userIdFeedC,
            eventType: 'workout_completed',
            payload: { workoutId: 998, dayNumber: 2 },
          },
        ],
      });
    });

    it('feed returns empty when user has no friends', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedC}`);
      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(0);
    });

    it('feed returns only events from confirmed friends', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedA}`);
      expect(res.status).toBe(200);
      // Only B's event should appear (not C's)
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
      const userIds = res.body.events.map((e: { userId: number }) => e.userId);
      expect(userIds).toContain(userIdFeedB);
      // C should NOT be in the feed
      res.body.events.forEach((e: { userId: number }) => {
        expect(e.userId).not.toBe(userIdFeedA); // No own events
      });
    });

    it('feed events include displayName and payload', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedA}`);
      expect(res.status).toBe(200);
      const event = res.body.events.find((e: { userId: number }) => e.userId === userIdFeedB);
      expect(event).toBeDefined();
      expect(event.displayName).toBe('Feed User B');
      expect(event.eventType).toBe('workout_completed');
      expect(event.payload).toHaveProperty('workoutId');
    });
  });

  describe('Feed reactions', () => {
    let tokenReactA: string;
    let tokenReactB: string;
    let tokenReactC: string;
    let feedEventId: number;

    beforeAll(async () => {
      const uidReact = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `react-a-${uidReact}@example.com`,
        password: 'password123',
        displayName: 'React User A',
      });
      tokenReactA = resA.body.accessToken;

      const resB = await request(app).post('/api/auth/register').send({
        email: `react-b-${uidReact}@example.com`,
        password: 'password123',
        displayName: 'React User B',
      });
      tokenReactB = resB.body.accessToken;
      const userIdReactB = resB.body.user.id;

      const resC = await request(app).post('/api/auth/register').send({
        email: `react-c-${uidReact}@example.com`,
        password: 'password123',
        displayName: 'React User C',
      });
      tokenReactC = resC.body.accessToken;

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ email: `react-b-${uidReact}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenReactB}`);

      // Create a feed event for B (friend of A)
      const feedEvent = await prisma.feedEvent.create({
        data: {
          userId: userIdReactB,
          eventType: 'workout_completed',
          payload: { workoutId: 777, dayNumber: 1 },
        },
      });
      feedEventId = feedEvent.id;
    });

    it('POST /feed/:eventId/react requires auth', async () => {
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid emoji', async () => {
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '😀' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent eventId', async () => {
      const res = await request(app)
        .post('/api/social/feed/999999999/react')
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(404);
    });

    it("returns 404 when reacting to a non-friend's event", async () => {
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactC}`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(404);
    });

    it('toggle on returns { reacted: true, count: 1 }', async () => {
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ reacted: true, count: 1 });
    });

    it('toggle off returns { reacted: false, count: 0 }', async () => {
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ reacted: false, count: 0 });
    });

    it('two users reacting with same emoji gives count: 2', async () => {
      // A reacts
      await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '💪' });

      // Need B to also be friends with B's own event author — B is the event author
      // B cannot react to their own event (they're not a friend of themselves)
      // So we need another user who is friends with B
      // tokenReactB's event — A is already a friend. Let's register user D as friend of B
      const uidD = randomUUID().slice(0, 8);
      const resD = await request(app).post('/api/auth/register').send({
        email: `react-d-${uidD}@example.com`,
        password: 'password123',
        displayName: 'React User D',
      });
      const tokenD = resD.body.accessToken;

      // Make B and D friends
      const reqRes2 = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenReactB}`)
        .send({ email: `react-d-${uidD}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes2.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenD}`);

      // D also reacts with same emoji
      const res = await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenD}`)
        .send({ emoji: '💪' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ reacted: true, count: 2 });
    });

    it('GET /social/feed includes reactions array with correct reactedByMe', async () => {
      // A has 💪 reaction on feedEventId (from previous test), D also has 💪
      // Re-add A's 🔥 reaction (was toggled off)
      await request(app)
        .post(`/api/social/feed/${feedEventId}/react`)
        .set('Authorization', `Bearer ${tokenReactA}`)
        .send({ emoji: '🔥' });

      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenReactA}`);
      expect(res.status).toBe(200);

      const event = res.body.events.find((e: { id: number }) => e.id === feedEventId);
      expect(event).toBeDefined();
      expect(Array.isArray(event.reactions)).toBe(true);

      // 🔥 reaction: A reacted, count=1, reactedByMe=true
      const fireReaction = event.reactions.find((r: { emoji: string }) => r.emoji === '🔥');
      expect(fireReaction).toBeDefined();
      expect(fireReaction.count).toBe(1);
      expect(fireReaction.reactedByMe).toBe(true);

      // 💪 reaction: A and D reacted, count=2, reactedByMe=true for A
      const muscleReaction = event.reactions.find((r: { emoji: string }) => r.emoji === '💪');
      expect(muscleReaction).toBeDefined();
      expect(muscleReaction.count).toBe(2);
      expect(muscleReaction.reactedByMe).toBe(true);
    });
  });

  describe('Streak', () => {
    let tokenStreakA: string;
    let tokenStreakB: string;
    let userIdStreakB: number;

    beforeAll(async () => {
      const uidStreak = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `streak-a-${uidStreak}@example.com`,
        password: 'password123',
        displayName: 'Streak User A',
      });
      tokenStreakA = resA.body.accessToken;

      const resB = await request(app).post('/api/auth/register').send({
        email: `streak-b-${uidStreak}@example.com`,
        password: 'password123',
        displayName: 'Streak User B',
      });
      tokenStreakB = resB.body.accessToken;
      userIdStreakB = resB.body.user.id;

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenStreakA}`)
        .send({ email: `streak-b-${uidStreak}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenStreakB}`);
    });

    it('friend with no workouts has streak 0 in GET /api/social/friends', async () => {
      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const friend = res.body.friends.find((f: { userId: number }) => f.userId === userIdStreakB);
      expect(friend).toBeDefined();
      expect(friend.streak).toBe(0);
    });

    it('friend with workout only today has streak >= 1', async () => {
      const today = new Date();
      await prisma.workout.create({
        data: {
          userId: userIdStreakB,
          dayNumber: 1,
          status: 'completed',
          completedAt: today,
        },
      });

      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const friend = res.body.friends.find((f: { userId: number }) => f.userId === userIdStreakB);
      expect(friend).toBeDefined();
      expect(friend.streak).toBeGreaterThanOrEqual(1);
    });

    it('friend with workouts today and yesterday has streak >= 2', async () => {
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      await prisma.workout.create({
        data: {
          userId: userIdStreakB,
          dayNumber: 1,
          status: 'completed',
          completedAt: yesterday,
        },
      });

      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const friend = res.body.friends.find((f: { userId: number }) => f.userId === userIdStreakB);
      expect(friend).toBeDefined();
      expect(friend.streak).toBeGreaterThanOrEqual(2);
    });

    it('friend with last workout 3 days ago has streak 0', async () => {
      // Register a separate user so we have a clean slate (no today/yesterday workouts)
      const uidOld = randomUUID().slice(0, 8);
      const resOld = await request(app).post('/api/auth/register').send({
        email: `streak-old-${uidOld}@example.com`,
        password: 'password123',
        displayName: 'Streak Old User',
      });
      const tokenOld = resOld.body.accessToken;
      const userIdOld = resOld.body.user.id;

      // Make A friends with old user
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenStreakA}`)
        .send({ email: `streak-old-${uidOld}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenOld}`);

      // Insert a workout 3 days ago
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await prisma.workout.create({
        data: {
          userId: userIdOld,
          dayNumber: 1,
          status: 'completed',
          completedAt: threeDaysAgo,
        },
      });

      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const friend = res.body.friends.find((f: { userId: number }) => f.userId === userIdOld);
      expect(friend).toBeDefined();
      expect(friend.streak).toBe(0);
    });

    it('multiple workouts same day count as streak 1 for that single day', async () => {
      const uidSingle = randomUUID().slice(0, 8);
      const resSingle = await request(app).post('/api/auth/register').send({
        email: `streak-single-${uidSingle}@example.com`,
        password: 'password123',
        displayName: 'Streak Single User',
      });
      const tokenSingle = resSingle.body.accessToken;
      const userIdSingle = resSingle.body.user.id;

      // Make A friends with single user
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenStreakA}`)
        .send({ email: `streak-single-${uidSingle}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenSingle}`);

      // Insert two workouts today
      const today = new Date();
      await prisma.workout.createMany({
        data: [
          { userId: userIdSingle, dayNumber: 1, status: 'completed', completedAt: today },
          { userId: userIdSingle, dayNumber: 2, status: 'completed', completedAt: today },
        ],
      });

      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const friend = res.body.friends.find((f: { userId: number }) => f.userId === userIdSingle);
      expect(friend).toBeDefined();
      // Two workouts same day = still only 1 day streak
      expect(friend.streak).toBe(1);
    });

    it('GET /api/social/feed events include correct streak field', async () => {
      // Create a feed event for streakB (who has today + yesterday workouts from earlier tests)
      await prisma.feedEvent.create({
        data: {
          userId: userIdStreakB,
          eventType: 'workout_completed',
          payload: { workoutId: 12345, dayNumber: 1 },
        },
      });

      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenStreakA}`);
      expect(res.status).toBe(200);
      const event = res.body.events.find((e: { userId: number }) => e.userId === userIdStreakB);
      expect(event).toBeDefined();
      expect(typeof event.streak).toBe('number');
      // streakB has workouts today and yesterday so streak should be >= 2
      expect(event.streak).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Leaderboard', () => {
    let tokenLbA: string;
    let userIdLbA: number;
    let tokenLbB: string;
    let userIdLbB: number;
    let benchExerciseId: number;

    beforeAll(async () => {
      const uidLb = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `lb-a-${uidLb}@example.com`,
        password: 'password123',
        displayName: 'LB User A',
      });
      tokenLbA = resA.body.accessToken;
      userIdLbA = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `lb-b-${uidLb}@example.com`,
        password: 'password123',
        displayName: 'LB User B',
      });
      tokenLbB = resB.body.accessToken;
      userIdLbB = resB.body.user.id;

      // Get bench exercise
      const bench = await prisma.exercise.findUnique({ where: { slug: 'bench-press' } });
      benchExerciseId = bench!.id;

      // Create a simple plan with bench
      const plan = await prisma.workoutPlan.create({
        data: {
          slug: `lb-plan-${uidLb}`,
          name: `LB Test Plan ${uidLb}`,
          description: 'Leaderboard test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });

      const day = await prisma.planDay.create({
        data: { planId: plan.id, dayNumber: 1, name: 'Day 1' },
      });

      await prisma.planDayExercise.create({
        data: {
          planDayId: day.id,
          exerciseId: benchExerciseId,
          tmExerciseId: benchExerciseId,
          sortOrder: 1,
        },
      });

      // Subscribe A and B to the plan
      await prisma.userPlan.create({ data: { userId: userIdLbA, planId: plan.id, isActive: true } });
      await prisma.userPlan.create({ data: { userId: userIdLbB, planId: plan.id, isActive: true } });

      // Set TMs: A=100kg, B=120kg
      const today = new Date();
      await prisma.trainingMax.createMany({
        data: [
          { userId: userIdLbA, exerciseId: benchExerciseId, weight: 100, effectiveDate: today },
          { userId: userIdLbB, exerciseId: benchExerciseId, weight: 120, effectiveDate: today },
        ],
      });

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenLbA}`)
        .send({ email: `lb-b-${uidLb}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenLbB}`);
    });

    it('returns empty exercises when user has no active plan', async () => {
      // Register a user with no plan
      const noPlanUid = randomUUID().slice(0, 8);
      const resNoPlan = await request(app).post('/api/auth/register').send({
        email: `lb-noplan-${noPlanUid}@example.com`,
        password: 'password123',
        displayName: 'No Plan User',
      });
      const noPlanToken = resNoPlan.body.accessToken;

      const res = await request(app)
        .get('/api/social/leaderboard')
        .set('Authorization', `Bearer ${noPlanToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ exercises: [] });
    });

    it('leaderboard shows TM rankings including friends', async () => {
      const res = await request(app)
        .get('/api/social/leaderboard')
        .set('Authorization', `Bearer ${tokenLbA}`);
      expect(res.status).toBe(200);
      expect(res.body.exercises).toHaveLength(1);

      const exercise = res.body.exercises[0];
      expect(exercise.slug).toBe('bench-press');
      expect(exercise.name).toBe('Bench Press');
      expect(exercise.rankings).toHaveLength(2);

      // Rankings are sorted by weight desc: B (120) before A (100)
      expect(exercise.rankings[0].userId).toBe(userIdLbB);
      expect(exercise.rankings[0].weight).toBe(120);
      expect(exercise.rankings[0].displayName).toBe('LB User B');

      expect(exercise.rankings[1].userId).toBe(userIdLbA);
      expect(exercise.rankings[1].weight).toBe(100);
      expect(exercise.rankings[1].displayName).toBe('LB User A');
    });

    it('leaderboard only shows friends TMs (excludes non-friends)', async () => {
      // Register a third user with a TM but not friends with A
      const uidStranger = randomUUID().slice(0, 8);
      const resStranger = await request(app).post('/api/auth/register').send({
        email: `lb-stranger-${uidStranger}@example.com`,
        password: 'password123',
        displayName: 'Stranger',
      });
      const strangerUserId = resStranger.body.user.id;

      await prisma.trainingMax.create({
        data: {
          userId: strangerUserId,
          exerciseId: benchExerciseId,
          weight: 200,
          effectiveDate: new Date(),
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard')
        .set('Authorization', `Bearer ${tokenLbA}`);
      expect(res.status).toBe(200);

      // Stranger should NOT appear
      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      const userIds = benchExercise.rankings.map((r: { userId: number }) => r.userId);
      expect(userIds).not.toContain(strangerUserId);
    });
  });
});
