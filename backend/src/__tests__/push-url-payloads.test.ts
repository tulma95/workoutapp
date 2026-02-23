import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

// Mock push service so we can inspect payloads without real VAPID keys
vi.mock('../services/push.service', () => ({
  pushService: {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock SSE notification manager — not under test here
vi.mock('../services/notifications.service', () => ({
  notificationManager: {
    notifyUser: vi.fn(),
    notifyFriends: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
  },
}));

import app from '../app';
import prisma from '../lib/db';
import { pushService } from '../services/push.service';

const uid = randomUUID().slice(0, 8);

// Helper to let fire-and-forget async blocks in route handlers finish
function flushAsync() {
  return new Promise<void>((resolve) => setTimeout(resolve, 50));
}

describe('Push notification payloads contain url field', () => {
  let tokenA: string;
  let userIdA: number;
  let usernameA: string;

  let tokenB: string;
  let userIdB: number;

  let friendshipId: number;
  let eventId: number;

  let planId: number;
  let benchExId: number;

  beforeAll(async () => {
    usernameA = `push_a_${uid}`;

    const resA = await request(app).post('/api/auth/register').send({
      email: `push-a-${uid}@example.com`,
      password: 'password123',
      username: usernameA,
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    const resB = await request(app).post('/api/auth/register').send({
      email: `push-b-${uid}@example.com`,
      password: 'password123',
      username: `push_b_${uid}`,
    });
    tokenB = resB.body.accessToken;
    userIdB = resB.body.user.id;

    // Become friends: A sends, B accepts
    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: `push-b-${uid}@example.com` });
    friendshipId = reqRes.body.id;

    await request(app)
      .patch(`/api/social/requests/${friendshipId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    // Feed event owned by userA so userB can comment on it
    const feedEvent = await prisma.feedEvent.create({
      data: {
        userId: userIdA,
        eventType: 'workout_completed',
        payload: { workoutId: 1, dayNumber: 1 },
      },
    });
    eventId = feedEvent.id;

    // Set up a minimal plan for workout completion tests
    const exercise = await prisma.exercise.findFirst({ where: { slug: 'bench-press' } });
    benchExId = exercise!.id;

    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `plan-push-${uid}`,
        name: 'Push URL Test Plan',
        description: 'Test plan',
        daysPerWeek: 1,
        isPublic: true,
        isSystem: false,
      },
    });
    planId = plan.id;

    await prisma.planProgressionRule.createMany({
      data: [{ planId, category: 'upper', minReps: 0, maxReps: 99, increase: 2.5 }],
    });

    const day1 = await prisma.planDay.create({
      data: { planId, dayNumber: 1, name: 'Day 1' },
    });

    const day1Ex = await prisma.planDayExercise.create({
      data: {
        planDayId: day1.id,
        exerciseId: benchExId,
        tmExerciseId: benchExId,
        sortOrder: 1,
      },
    });

    await prisma.planSet.createMany({
      data: [
        { planDayExerciseId: day1Ex.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
        { planDayExerciseId: day1Ex.id, setOrder: 2, percentage: 0.95, reps: 1, isAmrap: true, isProgression: true },
      ],
    });

    await request(app)
      .post(`/api/plans/${planId}/subscribe`)
      .set('Authorization', `Bearer ${tokenA}`);

    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ exerciseTMs: [{ exerciseId: benchExId, oneRepMax: 100 }] });
  });

  describe('comment_received push', () => {
    it('includes url pointing to the feed event when friend comments', async () => {
      const sendToUserSpy = vi.mocked(pushService.sendToUser);
      sendToUserSpy.mockClear();

      await request(app)
        .post(`/api/social/feed/${eventId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ text: 'Great job!' });

      // The push must have been called for the event owner (userA)
      const callsToOwner = sendToUserSpy.mock.calls.filter(([uid]) => uid === userIdA);
      expect(callsToOwner).toHaveLength(1);

      const payload = JSON.parse(callsToOwner[0]![1] as string);
      expect(payload.type).toBe('comment_received');
      expect(payload.url).toBe(`/social/feed?event=${eventId}`);
    });
  });

  describe('friend_request_received push', () => {
    it('includes url pointing to /social/friends when request is sent', async () => {
      const sendToUserSpy = vi.mocked(pushService.sendToUser);
      sendToUserSpy.mockClear();

      const uidFr = randomUUID().slice(0, 8);
      const resSender = await request(app).post('/api/auth/register').send({
        email: `push-fr-s-${uidFr}@example.com`,
        password: 'password123',
        username: `push_fr_s_${uidFr}`,
      });
      const senderToken = resSender.body.accessToken;

      const resRecipient = await request(app).post('/api/auth/register').send({
        email: `push-fr-r-${uidFr}@example.com`,
        password: 'password123',
        username: `push_fr_r_${uidFr}`,
      });
      const recipientId = resRecipient.body.user.id;

      await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ email: `push-fr-r-${uidFr}@example.com` });

      const callsToRecipient = sendToUserSpy.mock.calls.filter(([uid]) => uid === recipientId);
      expect(callsToRecipient).toHaveLength(1);

      const payload = JSON.parse(callsToRecipient[0]![1] as string);
      expect(payload.type).toBe('friend_request_received');
      expect(payload.url).toBe('/social/friends');
    });
  });

  describe('friend_request_accepted push', () => {
    it('includes url pointing to /social/friends when request is accepted', async () => {
      const sendToUserSpy = vi.mocked(pushService.sendToUser);
      sendToUserSpy.mockClear();

      const uidFa = randomUUID().slice(0, 8);
      const resSender = await request(app).post('/api/auth/register').send({
        email: `push-fa-s-${uidFa}@example.com`,
        password: 'password123',
        username: `push_fa_s_${uidFa}`,
      });
      const senderToken = resSender.body.accessToken;
      const senderId = resSender.body.user.id;

      const resReceiver = await request(app).post('/api/auth/register').send({
        email: `push-fa-r-${uidFa}@example.com`,
        password: 'password123',
        username: `push_fa_r_${uidFa}`,
      });
      const receiverToken = resReceiver.body.accessToken;

      const reqRes = await request(app)
        .post('/api/social/request')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ email: `push-fa-r-${uidFa}@example.com` });
      const frId = reqRes.body.id;

      sendToUserSpy.mockClear();

      await request(app)
        .patch(`/api/social/requests/${frId}/accept`)
        .set('Authorization', `Bearer ${receiverToken}`);

      // The push must target the original sender (initiator)
      const callsToSender = sendToUserSpy.mock.calls.filter(([uid]) => uid === senderId);
      expect(callsToSender).toHaveLength(1);

      const payload = JSON.parse(callsToSender[0]![1] as string);
      expect(payload.type).toBe('friend_request_accepted');
      expect(payload.url).toBe('/social/friends');
    });
  });

  describe('workout_completed push to friends', () => {
    it('sends push with url /social/feed to friends after workout completion', async () => {
      const sendToUserSpy = vi.mocked(pushService.sendToUser);
      sendToUserSpy.mockClear();

      const workout = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ dayNumber: 1 })
        .then((r) => r.body);

      await request(app)
        .post(`/api/workouts/${workout.id}/complete`)
        .set('Authorization', `Bearer ${tokenA}`);

      await flushAsync();

      // userB is a friend of userA — should receive the workout_completed push
      const callsToFriend = sendToUserSpy.mock.calls.filter(
        ([uid, payload]) => uid === userIdB && (JSON.parse(payload as string) as { type: string }).type === 'workout_completed',
      );
      expect(callsToFriend.length).toBeGreaterThanOrEqual(1);

      const payload = JSON.parse(callsToFriend[0]![1] as string);
      expect(payload.url).toBe('/social/feed');
    });
  });

  describe('achievement_earned push to self', () => {
    it('sends push with url /achievements to the user when they earn an achievement', async () => {
      const uidAch = randomUUID().slice(0, 8);
      const freshRes = await request(app).post('/api/auth/register').send({
        email: `push-ach-${uidAch}@example.com`,
        password: 'password123',
        username: `push_ach_${uidAch}`,
      });
      const freshToken = freshRes.body.accessToken;
      const freshUserId = freshRes.body.user.id;

      await request(app)
        .post(`/api/plans/${planId}/subscribe`)
        .set('Authorization', `Bearer ${freshToken}`);

      await request(app)
        .post('/api/training-maxes/setup')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ exerciseTMs: [{ exerciseId: benchExId, oneRepMax: 100 }] });

      const sendToUserSpy = vi.mocked(pushService.sendToUser);
      sendToUserSpy.mockClear();

      const workout = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ dayNumber: 1 })
        .then((r) => r.body);

      const completeRes = await request(app)
        .post(`/api/workouts/${workout.id}/complete`)
        .set('Authorization', `Bearer ${freshToken}`);

      expect(completeRes.status).toBe(200);
      // Fresh user should earn at least the first-blood achievement
      expect(completeRes.body.newAchievements.length).toBeGreaterThanOrEqual(1);

      await flushAsync();

      const achievementPushes = sendToUserSpy.mock.calls.filter(([uid, payload]) => {
        if (uid !== freshUserId) return false;
        const parsed = JSON.parse(payload as string) as { type: string };
        return parsed.type === 'badge_unlocked';
      });

      expect(achievementPushes.length).toBeGreaterThanOrEqual(1);

      const payload = JSON.parse(achievementPushes[0]![1] as string);
      expect(payload.url).toBe('/achievements');
    });
  });
});
