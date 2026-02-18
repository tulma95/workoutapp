import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

describe('Workouts API - Plan-Driven Generation', () => {
  const uid = randomUUID().slice(0, 8);
  let token: string;
  let userId: number;
  let planId: number;

  beforeAll(async () => {
    // Register regular user
    const res = await request(app).post('/api/auth/register').send({
      email: `wk-test-${uid}@example.com`,
      password: 'password123',
      displayName: 'Plan Workout Test',
    });
    token = res.body.accessToken;
    userId = res.body.user.id;

    // Create test exercises (these should already exist from setup.ts)
    const benchExercise = await prisma.exercise.upsert({
      where: { slug: 'bench-press' },
      update: {},
      create: {
        slug: 'bench-press',
        name: 'Bench Press',
        muscleGroup: 'chest',
        category: 'compound',
        isUpperBody: true,
      },
    });
    const squatExercise = await prisma.exercise.upsert({
      where: { slug: 'squat' },
      update: {},
      create: {
        slug: 'squat',
        name: 'Squat',
        muscleGroup: 'legs',
        category: 'compound',
        isUpperBody: false,
      },
    });
    const ohpExercise = await prisma.exercise.upsert({
      where: { slug: 'ohp' },
      update: {},
      create: {
        slug: 'ohp',
        name: 'Overhead Press',
        muscleGroup: 'shoulders',
        category: 'compound',
        isUpperBody: true,
      },
    });
    const deadliftExercise = await prisma.exercise.upsert({
      where: { slug: 'deadlift' },
      update: {},
      create: {
        slug: 'deadlift',
        name: 'Deadlift',
        muscleGroup: 'back',
        category: 'compound',
        isUpperBody: false,
      },
    });

    // Create test plan with minimal nSuns structure for Day 1
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `nsuns-${uid}`,
        name: 'Test nSuns 4-Day LP',
        description: 'Test plan',
        daysPerWeek: 4,
        isPublic: true,
        isSystem: false,
      },
    });

    planId = plan.id;

    // Create Day 1: Bench Volume + OHP
    const day1 = await prisma.planDay.create({
      data: {
        planId: plan.id,
        dayNumber: 1,
        name: 'Bench Volume & OHP',
      },
    });

    // T1: Bench Volume (9 sets)
    const t1Exercise = await prisma.planDayExercise.create({
      data: {
        planDayId: day1.id,
        exerciseId: benchExercise.id,
        sortOrder: 1,
        tmExerciseId: benchExercise.id,
        displayName: 'Bench Volume',
      },
    });

    // T1 sets for Day 1
    const t1Sets = [
      { percentage: 0.65, reps: 8, isAmrap: false, isProgression: false },
      { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
      { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
      { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
      { percentage: 0.85, reps: 4, isAmrap: false, isProgression: false },
      { percentage: 0.80, reps: 5, isAmrap: false, isProgression: false },
      { percentage: 0.75, reps: 6, isAmrap: false, isProgression: false },
      { percentage: 0.70, reps: 7, isAmrap: false, isProgression: false },
      { percentage: 0.65, reps: 8, isAmrap: true, isProgression: true },
    ];

    for (let i = 0; i < t1Sets.length; i++) {
      await prisma.planSet.create({
        data: {
          planDayExerciseId: t1Exercise.id,
          setOrder: i + 1,
          ...t1Sets[i]!,
        },
      });
    }

    // T2: OHP (8 sets)
    const t2Exercise = await prisma.planDayExercise.create({
      data: {
        planDayId: day1.id,
        exerciseId: ohpExercise.id,
        sortOrder: 2,
        tmExerciseId: ohpExercise.id,
      },
    });

    // T2 sets
    const t2Sets = [
      { percentage: 0.50, reps: 6 },
      { percentage: 0.60, reps: 5 },
      { percentage: 0.70, reps: 3 },
      { percentage: 0.70, reps: 5 },
      { percentage: 0.70, reps: 7 },
      { percentage: 0.70, reps: 4 },
      { percentage: 0.70, reps: 6 },
      { percentage: 0.70, reps: 8 },
    ];

    for (let i = 0; i < t2Sets.length; i++) {
      await prisma.planSet.create({
        data: {
          planDayExerciseId: t2Exercise.id,
          setOrder: i + 1,
          percentage: t2Sets[i]!.percentage,
          reps: t2Sets[i]!.reps,
          isAmrap: false,
          isProgression: false,
        },
      });
    }

    // Subscribe user to plan
    await prisma.userPlan.create({
      data: {
        userId,
        planId: plan.id,
        isActive: true,
      },
    });

    // Set up TMs using new exerciseTMs format
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseTMs: [
          { exerciseId: benchExercise.id, oneRepMax: 100 }, // TM = 90kg
          { exerciseId: squatExercise.id, oneRepMax: 140 }, // TM = 126kg
          { exerciseId: ohpExercise.id, oneRepMax: 60 }, // TM = 54kg
          { exerciseId: deadliftExercise.id, oneRepMax: 180 }, // TM = 162kg
        ],
      });
  });

  describe('POST /api/workouts - plan-driven', () => {
    it('creates workout from plan structure with correct sets', async () => {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });

      expect(res.status).toBe(201);
      expect(res.body.dayNumber).toBe(1);
      expect(res.body.status).toBe('in_progress');

      // Day 1 should have 9 T1 + 8 T2 = 17 sets
      expect(res.body.sets).toHaveLength(17);

      const t1Sets = res.body.sets.filter((s: { exerciseOrder: number }) => s.exerciseOrder === 1);
      const t2Sets = res.body.sets.filter((s: { exerciseOrder: number }) => s.exerciseOrder === 2);

      expect(t1Sets).toHaveLength(9);
      expect(t2Sets).toHaveLength(8);

      // T1 should be Bench Press, T2 should be Overhead Press
      expect(t1Sets[0].exercise).toBe('Bench Press');
      expect(t2Sets[0].exercise).toBe('Overhead Press');

      // Check progression flag is set correctly
      const progressionSets = res.body.sets.filter((s: { isProgression: boolean }) => s.isProgression);
      expect(progressionSets).toHaveLength(1);
      expect(progressionSets[0].exerciseOrder).toBe(1);
      expect(progressionSets[0].isAmrap).toBe(true);
    });

    it('validates dayNumber against plan daysPerWeek', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);

      if (currentRes.body) {
        await request(app)
          .delete(`/api/workouts/${currentRes.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid day number 5');
      expect(res.body.error.message).toContain('4 days per week');
    });

    it('returns 400 when missing TMs for plan exercises', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: `wk-notm-${uid}@example.com`,
        password: 'password123',
        displayName: 'No TM',
      });
      const noTmUserId = res.body.user.id;

      await prisma.userPlan.create({
        data: {
          userId: noTmUserId,
          planId: planId,
          isActive: true,
        },
      });

      const workoutRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ dayNumber: 1 });

      expect(workoutRes.status).toBe(400);
      expect(workoutRes.body.error.message).toContain('Training max not set');
    });

    it('creates workout with exerciseId and isProgression populated', async () => {
      const currentRes = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);

      if (currentRes.body) {
        await request(app)
          .delete(`/api/workouts/${currentRes.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });

      expect(res.status).toBe(201);

      const workout = await prisma.workout.findUnique({
        where: { id: res.body.id },
        include: { sets: true },
      });

      expect(workout).not.toBeNull();
      expect(workout?.planDayId).not.toBeNull();

      const sets = workout?.sets ?? [];
      expect(sets.every((s) => s.exerciseId !== null)).toBe(true);

      const progressionSets = sets.filter((s) => s.isProgression);
      expect(progressionSets).toHaveLength(1);
      expect(progressionSets[0]!.isProgression).toBe(true);
      expect(progressionSets[0]!.exerciseOrder).toBe(1);
      expect(progressionSets[0]!.isAmrap).toBe(true);
    });
  });

  describe('Backward compatibility - fallback to hardcoded logic', () => {
    let fallbackToken: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: `wk-fallback-${uid}@example.com`,
        password: 'password123',
        displayName: 'Fallback User',
      });
      fallbackToken = res.body.accessToken;
    });

    it('requires active plan when starting a workout', async () => {
      const res = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${fallbackToken}`)
        .send({ dayNumber: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No active workout plan');
    });

    it('returns empty array from getCurrentTMs when no TMs set', async () => {
      const res = await request(app)
        .get('/api/training-maxes')
        .set('Authorization', `Bearer ${fallbackToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /api/workouts/:id (discard completed)', () => {
    it('should discard a completed workout', async () => {
      // Cancel any existing in-progress workout
      const current = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      if (current.body?.id) {
        await request(app)
          .delete(`/api/workouts/${current.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      const startRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });
      const workoutId = startRes.body.id;

      await request(app)
        .post(`/api/workouts/${workoutId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should hide discarded completed workout from calendar', async () => {
      // Cancel any existing in-progress workout
      const current = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      if (current.body?.id) {
        await request(app)
          .delete(`/api/workouts/${current.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      const startRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });
      const workoutId = startRes.body.id;

      await request(app)
        .post(`/api/workouts/${workoutId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      await request(app)
        .delete(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      const now = new Date();
      const calRes = await request(app)
        .get(`/api/workouts/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
        .set('Authorization', `Bearer ${token}`);

      const ids = calRes.body.workouts.map((w: { id: number }) => w.id);
      expect(ids).not.toContain(workoutId);
    });
  });

  describe('GET /api/workouts/:id (progressions)', () => {
    it('should return progressions array after completing a workout with AMRAP', async () => {
      // Cancel any existing in-progress workout
      const current = await request(app)
        .get('/api/workouts/current')
        .set('Authorization', `Bearer ${token}`);
      if (current.body?.id) {
        await request(app)
          .delete(`/api/workouts/${current.body.id}`)
          .set('Authorization', `Bearer ${token}`);
      }

      // Start workout
      const startRes = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${token}`)
        .send({ dayNumber: 1 });
      const workoutId = startRes.body.id;

      // Log AMRAP reps on the progression set (set with isProgression: true)
      const progressionSet = startRes.body.sets.find((s: { isProgression?: boolean }) => s.isProgression);
      if (progressionSet) {
        await request(app)
          .patch(`/api/workouts/${workoutId}/sets/${progressionSet.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ actualReps: 10, completed: true });
      }

      // Complete workout
      const completeRes = await request(app)
        .post(`/api/workouts/${workoutId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      // Fetch workout and verify progressions
      const res = await request(app)
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.progressions).toBeDefined();
      expect(Array.isArray(res.body.progressions)).toBe(true);

      // If the complete endpoint returned progressions, the getWorkout should too
      const completedProgressions = completeRes.body.progressions || [];
      if (completedProgressions.length > 0) {
        expect(res.body.progressions.length).toBe(completedProgressions.length);
        expect(res.body.progressions[0]).toHaveProperty('exercise');
        expect(res.body.progressions[0]).toHaveProperty('previousTM');
        expect(res.body.progressions[0]).toHaveProperty('newTM');
        expect(res.body.progressions[0]).toHaveProperty('increase');
        expect(res.body.progressions[0].increase).toBeGreaterThan(0);
      }
    });
  });
});
