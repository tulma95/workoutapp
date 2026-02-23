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
      username: `social_a_${uid}`,
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // Register user B
    emailB = `social-b-${uid}@example.com`;
    const resB = await request(app).post('/api/auth/register').send({
      email: emailB,
      password: 'password123',
      username: `social_b_${uid}`,
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
      expect(res.body.requests[0].username).toBe(`social_a_${uid}`);
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
      expect(resA.body.friends[0].username).toBe(`social_b_${uid}`);
      expect(resA.body.friends[0].userId).toBe(userIdB);

      const resB = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.body.friends).toHaveLength(1);
      expect(resB.body.friends[0].username).toBe(`social_a_${uid}`);
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
        username: `social_d_${uid}`,
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
      expect(aReqs.body.requests.some((r: { username: string }) => r.username === `social_d_${uid}`)).toBe(false);
    });

    it('user can decline a pending request', async () => {
      // Register user C for this test
      const emailC = `social-c-${uid}@example.com`;
      const resC = await request(app).post('/api/auth/register').send({
        email: emailC,
        password: 'password123',
        username: `social_c_${uid}`,
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
    let userIdFeedC: number;

    beforeAll(async () => {
      const uidFeed = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `feed-a-${uidFeed}@example.com`,
        password: 'password123',
        username: `feed_a_${uidFeed}`,
      });
      tokenFeedA = resA.body.accessToken;
      userIdFeedA = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `feed-b-${uidFeed}@example.com`,
        password: 'password123',
        username: `feed_b_${uidFeed}`,
      });
      tokenFeedB = resB.body.accessToken;
      userIdFeedB = resB.body.user.id;

      // Register user C (not a friend)
      const resC = await request(app).post('/api/auth/register').send({
        email: `feed-c-${uidFeed}@example.com`,
        password: 'password123',
        username: `feed_c_${uidFeed}`,
      });
      tokenFeedC = resC.body.accessToken;
      userIdFeedC = resC.body.user.id;

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenFeedA}`)
        .send({ email: `feed-b-${uidFeed}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenFeedB}`);

      // Create feed events for A (self), B (friend of A), and C (not friend of A)
      await prisma.feedEvent.createMany({
        data: [
          {
            userId: userIdFeedA,
            eventType: 'workout_completed',
            payload: { workoutId: 1000, dayNumber: 3 },
          },
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

    it('feed returns own events even when user has no friends', async () => {
      // C has no friends but has their own event (workoutId: 998)
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedC}`);
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
      const userIds = res.body.events.map((e: { userId: number }) => e.userId);
      expect(userIds).toContain(userIdFeedC);
    });

    it('feed returns own events and friends events, but not strangers', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedA}`);
      expect(res.status).toBe(200);
      // A's own event and B's event should appear
      expect(res.body.events.length).toBeGreaterThanOrEqual(2);
      const userIds = res.body.events.map((e: { userId: number }) => e.userId);
      expect(userIds).toContain(userIdFeedA); // own events included
      expect(userIds).toContain(userIdFeedB); // friend's events included
      // C (not a friend) should NOT be in the feed
      expect(userIds).not.toContain(userIdFeedC);
    });

    it('feed events include username and payload', async () => {
      const res = await request(app)
        .get('/api/social/feed')
        .set('Authorization', `Bearer ${tokenFeedA}`);
      expect(res.status).toBe(200);
      const event = res.body.events.find((e: { userId: number }) => e.userId === userIdFeedB);
      expect(event).toBeDefined();
      expect(typeof event.username).toBe('string');
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
        username: `react_a_${uidReact}`,
      });
      tokenReactA = resA.body.accessToken;

      const resB = await request(app).post('/api/auth/register').send({
        email: `react-b-${uidReact}@example.com`,
        password: 'password123',
        username: `react_b_${uidReact}`,
      });
      tokenReactB = resB.body.accessToken;
      const userIdReactB = resB.body.user.id;

      const resC = await request(app).post('/api/auth/register').send({
        email: `react-c-${uidReact}@example.com`,
        password: 'password123',
        username: `react_c_${uidReact}`,
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
        username: `react_d_${uidD}`,
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
        username: `streak_a_${uidStreak}`,
      });
      tokenStreakA = resA.body.accessToken;

      const resB = await request(app).post('/api/auth/register').send({
        email: `streak-b-${uidStreak}@example.com`,
        password: 'password123',
        username: `streak_b_${uidStreak}`,
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
        username: `streak_old_${uidOld}`,
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
        username: `streak_single_${uidSingle}`,
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

  describe('Leaderboard e1RM', () => {
    let tokenE1rmA: string;
    let userIdE1rmA: number;
    let tokenE1rmB: string;
    let userIdE1rmB: number;
    let e1rmBenchExerciseId: number;
    let e1rmSquatExerciseId: number;
    let e1rmPlanId: number;

    beforeAll(async () => {
      const uidE1rm = randomUUID().slice(0, 8);

      const resA = await request(app).post('/api/auth/register').send({
        email: `e1rm-a-${uidE1rm}@example.com`,
        password: 'password123',
        username: `e1rm_a_${uidE1rm}`,
      });
      tokenE1rmA = resA.body.accessToken;
      userIdE1rmA = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `e1rm-b-${uidE1rm}@example.com`,
        password: 'password123',
        username: `e1rm_b_${uidE1rm}`,
      });
      tokenE1rmB = resB.body.accessToken;
      userIdE1rmB = resB.body.user.id;

      // Get exercises
      const bench = await prisma.exercise.findUnique({ where: { slug: 'bench-press' } });
      e1rmBenchExerciseId = bench!.id;
      const squat = await prisma.exercise.findUnique({ where: { slug: 'squat' } });
      e1rmSquatExerciseId = squat!.id;

      // Create a plan with bench and squat
      const plan = await prisma.workoutPlan.create({
        data: {
          slug: `e1rm-plan-${uidE1rm}`,
          name: `E1RM Test Plan ${uidE1rm}`,
          description: 'E1RM leaderboard test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      e1rmPlanId = plan.id;

      const day = await prisma.planDay.create({
        data: { planId: plan.id, dayNumber: 1, name: 'Day 1' },
      });

      await prisma.planDayExercise.createMany({
        data: [
          {
            planDayId: day.id,
            exerciseId: e1rmBenchExerciseId,
            tmExerciseId: e1rmBenchExerciseId,
            sortOrder: 1,
          },
          {
            planDayId: day.id,
            exerciseId: e1rmSquatExerciseId,
            tmExerciseId: e1rmSquatExerciseId,
            sortOrder: 2,
          },
        ],
      });

      // Subscribe A and B to the plan
      await prisma.userPlan.createMany({
        data: [
          { userId: userIdE1rmA, planId: plan.id, isActive: true },
          { userId: userIdE1rmB, planId: plan.id, isActive: true },
        ],
      });

      // Make A and B friends
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenE1rmA}`)
        .send({ email: `e1rm-b-${uidE1rm}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenE1rmB}`);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/social/leaderboard?mode=e1rm');
      expect(res.status).toBe(401);
    });

    it('returns { exercises: [] } when user has no active plan', async () => {
      const noPlanUid = randomUUID().slice(0, 8);
      const resNoPlan = await request(app).post('/api/auth/register').send({
        email: `e1rm-noplan-${noPlanUid}@example.com`,
        password: 'password123',
        username: `e1rm_noplan_${noPlanUid}`,
      });
      const noPlanToken = resNoPlan.body.accessToken;

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${noPlanToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ exercises: [] });
    });

    it('computes correct Epley e1RM and rank order for friends', async () => {
      // A: 100kg x 10 reps => 100 * (1 + 10/30) = 100 * 1.3333... = 133.333...
      // B: 80kg x 5 reps  => 80 * (1 + 5/30)  = 80 * 1.1666...  = 93.333...
      // Expected rank: A (133.33) before B (93.33)
      const workoutA = await prisma.workout.create({
        data: {
          userId: userIdE1rmA,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      await prisma.workoutSet.create({
        data: {
          workoutId: workoutA.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 10,
          prescribedWeight: 100,
          isAmrap: true,
          actualReps: 10,
          completed: true,
        },
      });

      const workoutB = await prisma.workout.create({
        data: {
          userId: userIdE1rmB,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      await prisma.workoutSet.create({
        data: {
          workoutId: workoutB.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 5,
          prescribedWeight: 80,
          isAmrap: true,
          actualReps: 5,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenE1rmA}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      expect(benchExercise).toBeDefined();
      expect(benchExercise.rankings.length).toBeGreaterThanOrEqual(2);

      const rankA = benchExercise.rankings.find((r: { userId: number }) => r.userId === userIdE1rmA);
      const rankB = benchExercise.rankings.find((r: { userId: number }) => r.userId === userIdE1rmB);
      expect(rankA).toBeDefined();
      expect(rankB).toBeDefined();

      // 100 * (1 + 10/30) = 133.333...
      expect(rankA.weight).toBeCloseTo(133.333, 2);
      // 80 * (1 + 5/30) = 93.333...
      expect(rankB.weight).toBeCloseTo(93.333, 2);

      // A should rank above B
      const indexA = benchExercise.rankings.findIndex((r: { userId: number }) => r.userId === userIdE1rmA);
      const indexB = benchExercise.rankings.findIndex((r: { userId: number }) => r.userId === userIdE1rmB);
      expect(indexA).toBeLessThan(indexB);
    });

    it('excludes non-friends (users who have not mutually friended)', async () => {
      const uidStranger = randomUUID().slice(0, 8);
      const resStranger = await request(app).post('/api/auth/register').send({
        email: `e1rm-stranger-${uidStranger}@example.com`,
        password: 'password123',
        username: `e1rm_stranger_${uidStranger}`,
      });
      const strangerUserId = resStranger.body.user.id;

      // Give stranger a plan subscription so they have context
      await prisma.userPlan.create({
        data: { userId: strangerUserId, planId: e1rmPlanId, isActive: true },
      });

      // Create a workout with a high e1RM for stranger (not friend of A)
      const strangerWorkout = await prisma.workout.create({
        data: {
          userId: strangerUserId,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      await prisma.workoutSet.create({
        data: {
          workoutId: strangerWorkout.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 5,
          prescribedWeight: 300,
          isAmrap: true,
          actualReps: 20,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenE1rmA}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      const userIds = (benchExercise?.rankings ?? []).map((r: { userId: number }) => r.userId);
      expect(userIds).not.toContain(strangerUserId);
    });

    it('deduplicates multiple AMRAP sets per user, taking max e1RM', async () => {
      // Create a fresh isolated user to avoid interference from earlier tests
      const uidDedup = randomUUID().slice(0, 8);
      const resDedupUser = await request(app).post('/api/auth/register').send({
        email: `e1rm-dedup-${uidDedup}@example.com`,
        password: 'password123',
        username: `e1rm_dedup_${uidDedup}`,
      });
      const tokenDedupUser = resDedupUser.body.accessToken;
      const userIdDedupUser = resDedupUser.body.user.id;

      // Create a new plan for dedup test isolation
      const dedupPlan = await prisma.workoutPlan.create({
        data: {
          slug: `dedup-plan-${uidDedup}`,
          name: `Dedup Plan ${uidDedup}`,
          description: 'Dedup test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      const dedupDay = await prisma.planDay.create({
        data: { planId: dedupPlan.id, dayNumber: 1, name: 'Day 1' },
      });
      await prisma.planDayExercise.create({
        data: {
          planDayId: dedupDay.id,
          exerciseId: e1rmBenchExerciseId,
          tmExerciseId: e1rmBenchExerciseId,
          sortOrder: 1,
        },
      });
      await prisma.userPlan.createMany({
        data: [
          { userId: userIdE1rmA, planId: dedupPlan.id, isActive: false },
          { userId: userIdDedupUser, planId: dedupPlan.id, isActive: true },
        ],
      });

      // Make A friends with dedupUser
      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenE1rmA}`)
        .send({ email: `e1rm-dedup-${uidDedup}@example.com` });
      await request(app)
        .patch(`/api/social/requests/${reqRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenDedupUser}`);

      // dedupUser has two completed AMRAP sets for bench:
      // Set 1: 100kg x 5 reps => 100 * (1 + 5/30) = 116.666...
      // Set 2: 100kg x 10 reps => 100 * (1 + 10/30) = 133.333... (should be taken)
      const dedupWorkout = await prisma.workout.create({
        data: {
          userId: userIdDedupUser,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      await prisma.workoutSet.createMany({
        data: [
          {
            workoutId: dedupWorkout.id,
            exerciseId: e1rmBenchExerciseId,
            exerciseOrder: 1,
            setOrder: 1,
            prescribedReps: 5,
            prescribedWeight: 100,
            isAmrap: true,
            actualReps: 5,
            completed: true,
          },
          {
            workoutId: dedupWorkout.id,
            exerciseId: e1rmBenchExerciseId,
            exerciseOrder: 1,
            setOrder: 2,
            prescribedReps: 10,
            prescribedWeight: 100,
            isAmrap: true,
            actualReps: 10,
            completed: true,
          },
        ],
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenDedupUser}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      expect(benchExercise).toBeDefined();

      const rankDedup = benchExercise.rankings.find(
        (r: { userId: number }) => r.userId === userIdDedupUser
      );
      expect(rankDedup).toBeDefined();
      // Must take the max: 133.333, not the lower 116.666
      expect(rankDedup.weight).toBeCloseTo(133.333, 2);
    });

    it('excludes sets from discarded workouts', async () => {
      const uidDiscard = randomUUID().slice(0, 8);
      const resDiscardUser = await request(app).post('/api/auth/register').send({
        email: `e1rm-discard-${uidDiscard}@example.com`,
        password: 'password123',
        username: `e1rm_discard_${uidDiscard}`,
      });
      const tokenDiscardUser = resDiscardUser.body.accessToken;
      const userIdDiscardUser = resDiscardUser.body.user.id;

      // Create isolated plan
      const discardPlan = await prisma.workoutPlan.create({
        data: {
          slug: `discard-plan-${uidDiscard}`,
          name: `Discard Plan ${uidDiscard}`,
          description: 'Discard test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      const discardDay = await prisma.planDay.create({
        data: { planId: discardPlan.id, dayNumber: 1, name: 'Day 1' },
      });
      await prisma.planDayExercise.create({
        data: {
          planDayId: discardDay.id,
          exerciseId: e1rmBenchExerciseId,
          tmExerciseId: e1rmBenchExerciseId,
          sortOrder: 1,
        },
      });
      await prisma.userPlan.create({
        data: { userId: userIdDiscardUser, planId: discardPlan.id, isActive: true },
      });

      // Discarded workout with high e1RM — should NOT appear
      const discardedWorkout = await prisma.workout.create({
        data: {
          userId: userIdDiscardUser,
          dayNumber: 1,
          status: 'discarded',
        },
      });
      await prisma.workoutSet.create({
        data: {
          workoutId: discardedWorkout.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 10,
          prescribedWeight: 200,
          isAmrap: true,
          actualReps: 10,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenDiscardUser}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      // discardUser has no completed workouts, so they should not appear in rankings
      const userIds = (benchExercise?.rankings ?? []).map((r: { userId: number }) => r.userId);
      expect(userIds).not.toContain(userIdDiscardUser);
    });

    it('excludes sets with actualReps=null', async () => {
      const uidNull = randomUUID().slice(0, 8);
      const resNullUser = await request(app).post('/api/auth/register').send({
        email: `e1rm-null-${uidNull}@example.com`,
        password: 'password123',
        username: `e1rm_null_${uidNull}`,
      });
      const tokenNullUser = resNullUser.body.accessToken;
      const userIdNullUser = resNullUser.body.user.id;

      const nullPlan = await prisma.workoutPlan.create({
        data: {
          slug: `null-plan-${uidNull}`,
          name: `Null Plan ${uidNull}`,
          description: 'Null reps test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      const nullDay = await prisma.planDay.create({
        data: { planId: nullPlan.id, dayNumber: 1, name: 'Day 1' },
      });
      await prisma.planDayExercise.create({
        data: {
          planDayId: nullDay.id,
          exerciseId: e1rmBenchExerciseId,
          tmExerciseId: e1rmBenchExerciseId,
          sortOrder: 1,
        },
      });
      await prisma.userPlan.create({
        data: { userId: userIdNullUser, planId: nullPlan.id, isActive: true },
      });

      const nullWorkout = await prisma.workout.create({
        data: {
          userId: userIdNullUser,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      // Set with actualReps=null (not filled in)
      await prisma.workoutSet.create({
        data: {
          workoutId: nullWorkout.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 10,
          prescribedWeight: 150,
          isAmrap: true,
          actualReps: null,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenNullUser}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      const userIds = (benchExercise?.rankings ?? []).map((r: { userId: number }) => r.userId);
      expect(userIds).not.toContain(userIdNullUser);
    });

    it('excludes sets with actualReps=0', async () => {
      const uidZero = randomUUID().slice(0, 8);
      const resZeroUser = await request(app).post('/api/auth/register').send({
        email: `e1rm-zero-${uidZero}@example.com`,
        password: 'password123',
        username: `e1rm_zero_${uidZero}`,
      });
      const tokenZeroUser = resZeroUser.body.accessToken;
      const userIdZeroUser = resZeroUser.body.user.id;

      const zeroPlan = await prisma.workoutPlan.create({
        data: {
          slug: `zero-plan-${uidZero}`,
          name: `Zero Plan ${uidZero}`,
          description: 'Zero reps test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      const zeroDay = await prisma.planDay.create({
        data: { planId: zeroPlan.id, dayNumber: 1, name: 'Day 1' },
      });
      await prisma.planDayExercise.create({
        data: {
          planDayId: zeroDay.id,
          exerciseId: e1rmBenchExerciseId,
          tmExerciseId: e1rmBenchExerciseId,
          sortOrder: 1,
        },
      });
      await prisma.userPlan.create({
        data: { userId: userIdZeroUser, planId: zeroPlan.id, isActive: true },
      });

      const zeroWorkout = await prisma.workout.create({
        data: {
          userId: userIdZeroUser,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      await prisma.workoutSet.create({
        data: {
          workoutId: zeroWorkout.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 10,
          prescribedWeight: 150,
          isAmrap: true,
          actualReps: 0,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenZeroUser}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      const userIds = (benchExercise?.rankings ?? []).map((r: { userId: number }) => r.userId);
      expect(userIds).not.toContain(userIdZeroUser);
    });

    it('actualReps=1 returns base weight without Epley inflation', async () => {
      const uidOne = randomUUID().slice(0, 8);
      const resOneUser = await request(app).post('/api/auth/register').send({
        email: `e1rm-one-${uidOne}@example.com`,
        password: 'password123',
        username: `e1rm_one_${uidOne}`,
      });
      const tokenOneUser = resOneUser.body.accessToken;
      const userIdOneUser = resOneUser.body.user.id;

      const onePlan = await prisma.workoutPlan.create({
        data: {
          slug: `one-plan-${uidOne}`,
          name: `One Rep Plan ${uidOne}`,
          description: 'One rep test',
          daysPerWeek: 1,
          isPublic: true,
          isSystem: false,
        },
      });
      const oneDay = await prisma.planDay.create({
        data: { planId: onePlan.id, dayNumber: 1, name: 'Day 1' },
      });
      await prisma.planDayExercise.create({
        data: {
          planDayId: oneDay.id,
          exerciseId: e1rmBenchExerciseId,
          tmExerciseId: e1rmBenchExerciseId,
          sortOrder: 1,
        },
      });
      await prisma.userPlan.create({
        data: { userId: userIdOneUser, planId: onePlan.id, isActive: true },
      });

      const oneWorkout = await prisma.workout.create({
        data: {
          userId: userIdOneUser,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
        },
      });
      // 120kg x 1 rep => should return 120, not 120 * (1 + 1/30) = 124
      await prisma.workoutSet.create({
        data: {
          workoutId: oneWorkout.id,
          exerciseId: e1rmBenchExerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedReps: 1,
          prescribedWeight: 120,
          isAmrap: true,
          actualReps: 1,
          completed: true,
        },
      });

      const res = await request(app)
        .get('/api/social/leaderboard?mode=e1rm')
        .set('Authorization', `Bearer ${tokenOneUser}`);
      expect(res.status).toBe(200);

      const benchExercise = res.body.exercises.find(
        (e: { slug: string }) => e.slug === 'bench-press'
      );
      expect(benchExercise).toBeDefined();

      const rankOne = benchExercise.rankings.find(
        (r: { userId: number }) => r.userId === userIdOneUser
      );
      expect(rankOne).toBeDefined();
      // Special case: actualReps === 1 => returns base weight exactly
      expect(rankOne.weight).toBe(120);
    });
  });

  describe('Request by username', () => {
    let tokenU1: string;
    let tokenU2: string;
    let usernameU2: string;

    beforeAll(async () => {
      const uidU = randomUUID().slice(0, 8);
      usernameU2 = `user_${uidU}`;

      const resU1 = await request(app).post('/api/auth/register').send({
        email: `username-u1-${uidU}@example.com`,
        password: 'password123',
        username: `username_u1_${uidU}`,
      });
      tokenU1 = resU1.body.accessToken;

      const resU2 = await request(app).post('/api/auth/register').send({
        email: `username-u2-${uidU}@example.com`,
        password: 'password123',
        username: usernameU2,
      });
      tokenU2 = resU2.body.accessToken;
    });

    it('returns 400 when neither email nor username is provided', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenU1}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELD');
    });

    it('returns 400 when both email and username are provided', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenU1}`)
        .send({ email: 'someone@example.com', username: usernameU2 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AMBIGUOUS_FIELD');
    });

    it('returns 404 when username does not exist', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenU1}`)
        .send({ username: 'nonexistent_xyz_999' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('sends a friend request by username', async () => {
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenU1}`)
        .send({ username: usernameU2 });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 409 when already friends (by username)', async () => {
      // Accept the pending request from the previous test, then try again by username
      const reqsRes = await request(app)
        .get('/api/social/requests')
        .set('Authorization', `Bearer ${tokenU2}`);
      const pending = reqsRes.body.requests[0];
      await request(app)
        .patch(`/api/social/requests/${pending.id}/accept`)
        .set('Authorization', `Bearer ${tokenU2}`);

      // Now U1 tries to send another request by username
      const res = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${tokenU1}`)
        .send({ username: usernameU2 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_EXISTS');
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
        username: `lb_a_${uidLb}`,
      });
      tokenLbA = resA.body.accessToken;
      userIdLbA = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `lb-b-${uidLb}@example.com`,
        password: 'password123',
        username: `lb_b_${uidLb}`,
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
        username: `lb_noplan_${noPlanUid}`,
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
      expect(typeof exercise.rankings[0].username).toBe('string');

      expect(exercise.rankings[1].userId).toBe(userIdLbA);
      expect(exercise.rankings[1].weight).toBe(100);
      expect(typeof exercise.rankings[1].username).toBe('string');
    });

    it('leaderboard only shows friends TMs (excludes non-friends)', async () => {
      // Register a third user with a TM but not friends with A
      const uidStranger = randomUUID().slice(0, 8);
      const resStranger = await request(app).post('/api/auth/register').send({
        email: `lb-stranger-${uidStranger}@example.com`,
        password: 'password123',
        username: `lb_stranger_${uidStranger}`,
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
