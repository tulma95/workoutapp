import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

vi.mock('../services/notifications.service', () => ({
  notificationManager: {
    notifyUser: vi.fn(),
    notifyFriends: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
  },
}));

import app from '../app';
import prisma from '../lib/db';
import { notificationManager } from '../services/notifications.service';

const uid = randomUUID().slice(0, 8);

describe('Workout completion — notifications', () => {
  let token: string;
  let userId: number;
  let username: string;
  let planId: number;
  let benchExId: number;

  beforeAll(async () => {
    username = `wn_${uid}`;
    const res = await request(app).post('/api/auth/register').send({
      email: `wn-${uid}@example.com`,
      password: 'password123',
      username,
    });
    token = res.body.accessToken;
    userId = res.body.user.id;

    // Get bench press exercise ID
    const exercise = await prisma.exercise.findFirst({ where: { slug: 'bench-press' } });
    benchExId = exercise!.id;

    // Create a minimal test plan with one progression set
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `plan-wn-${uid}`,
        name: 'Workout Notifications Test Plan',
        description: 'Test plan',
        daysPerWeek: 1,
        isPublic: true,
        isSystem: false,
      },
    });
    planId = plan.id;

    await prisma.planProgressionRule.createMany({
      data: [
        { planId, category: 'upper', minReps: 0, maxReps: 99, increase: 2.5 },
      ],
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

    // Subscribe user and set up TM
    await request(app)
      .post(`/api/plans/${planId}/subscribe`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ exerciseTMs: [{ exerciseId: benchExId, oneRepMax: 100 }] });
  });

  async function startWorkout() {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber: 1 });
    return res.body;
  }

  async function completeWorkout(workoutId: number) {
    const res = await request(app)
      .post(`/api/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    return res;
  }

  // Helper to let the fire-and-forget async IIFE in the route handler finish
  function flushAsync() {
    return new Promise<void>((resolve) => setTimeout(resolve, 50));
  }

  it('calls notifyFriends with workout_completed after workout completion', async () => {
    const notifyFriendsSpy = vi.mocked(notificationManager.notifyFriends);
    notifyFriendsSpy.mockClear();

    const workout = await startWorkout();
    const res = await completeWorkout(workout.id);

    expect(res.status).toBe(200);
    expect(res.body.workout.status).toBe('completed');

    await flushAsync();

    expect(notifyFriendsSpy).toHaveBeenCalledWith(userId, {
      type: 'workout_completed',
      message: `${username} just finished Day 1`,
    });
  });

  it('calls notifyFriends with correct dayNumber in the message', async () => {
    const notifyFriendsSpy = vi.mocked(notificationManager.notifyFriends);
    notifyFriendsSpy.mockClear();

    const workout = await startWorkout();
    await completeWorkout(workout.id);

    await flushAsync();

    const workoutCompletedCalls = notifyFriendsSpy.mock.calls.filter(
      ([, payload]) => payload.type === 'workout_completed',
    );
    expect(workoutCompletedCalls).toHaveLength(1);
    const firstCall = workoutCompletedCalls[0]!;
    expect(firstCall[0]).toBe(userId);
    expect(firstCall[1].message).toContain('Day 1');
    expect(firstCall[1].message).toContain(username);
  });

  it('does not call notifyFriends with achievement_earned when no achievements are unlocked', async () => {
    const notifyFriendsSpy = vi.mocked(notificationManager.notifyFriends);
    notifyFriendsSpy.mockClear();

    // Start a later workout (first-blood already unlocked) without logging progression reps
    const workout = await startWorkout();
    await completeWorkout(workout.id);

    await flushAsync();

    const achievementCalls = notifyFriendsSpy.mock.calls.filter(
      ([, payload]) => payload.type === 'achievement_earned',
    );
    expect(achievementCalls).toHaveLength(0);
  });

  it('calls notifyFriends with achievement_earned for each new achievement', async () => {
    // Mock checkAndUnlockAchievements behavior is hard to control — instead
    // we verify that when the first-blood achievement triggers on a fresh user,
    // notifyFriends is called with type achievement_earned.
    const uidFresh = randomUUID().slice(0, 8);
    const freshUsername = `wn_fresh_${uidFresh}`;
    const freshRes = await request(app).post('/api/auth/register').send({
      email: `wn-fresh-${uidFresh}@example.com`,
      password: 'password123',
      username: freshUsername,
    });
    const freshToken = freshRes.body.accessToken;
    const freshUserId = freshRes.body.user.id;

    // Subscribe fresh user to the same plan and set up TMs
    await request(app)
      .post(`/api/plans/${planId}/subscribe`)
      .set('Authorization', `Bearer ${freshToken}`);
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ exerciseTMs: [{ exerciseId: benchExId, oneRepMax: 100 }] });

    const notifyFriendsSpy = vi.mocked(notificationManager.notifyFriends);
    notifyFriendsSpy.mockClear();

    // Start and complete first workout — triggers the 'first-blood' achievement
    const workout = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ dayNumber: 1 })
      .then((r) => r.body);

    const completeRes = await request(app)
      .post(`/api/workouts/${workout.id}/complete`)
      .set('Authorization', `Bearer ${freshToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.newAchievements.length).toBeGreaterThanOrEqual(1);

    await flushAsync();

    // For each new achievement returned, there should be a corresponding notifyFriends call
    const achievementCalls = notifyFriendsSpy.mock.calls.filter(
      ([, payload]) => payload.type === 'achievement_earned',
    );
    expect(achievementCalls.length).toBe(completeRes.body.newAchievements.length);

    // All achievement calls target the fresh user
    for (const [calledUserId, payload] of achievementCalls) {
      expect(calledUserId).toBe(freshUserId);
      expect(payload.message).toContain(freshUsername);
      expect(payload.message).toContain('earned');
    }
  });
});
