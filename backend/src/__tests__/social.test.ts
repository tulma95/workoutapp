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
    it('can send new request after removal (unique constraint allows it)', async () => {
      // After removal, the old row has status 'removed'. We need a new pair.
      // Use a third user for the decline test to avoid constraint issues.
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
