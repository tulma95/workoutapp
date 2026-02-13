import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('Workout Completion - Plan-Driven', () => {
  let token: string;
  let userId: number;
  let planId: number;
  let benchExId: number;
  let squatExId: number;
  let deadliftExId: number;
  let ohpExId: number;

  beforeAll(async () => {
    // Register user
    const res = await request(app).post('/api/auth/register').send({
      email: `completion-${uid}@example.com`,
      password: 'password123',
      displayName: 'Plan Completion Test',
      unitPreference: 'kg',
    });
    token = res.body.accessToken;
    userId = res.body.user.id;

    // Get exercise IDs
    const exercises = await prisma.exercise.findMany({
      where: { slug: { in: ['bench-press', 'squat', 'deadlift', 'ohp'] } },
    });
    benchExId = exercises.find((e) => e.slug === 'bench-press')!.id;
    squatExId = exercises.find((e) => e.slug === 'squat')!.id;
    deadliftExId = exercises.find((e) => e.slug === 'deadlift')!.id;
    ohpExId = exercises.find((e) => e.slug === 'ohp')!.id;

    // Create a test plan with progression rules
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `plan-completion-${uid}`,
        name: 'Test Plan for Completion',
        description: 'Test plan',
        daysPerWeek: 2,
        isPublic: true,
        isSystem: false,
      },
    });
    planId = plan.id;

    // Create progression rules (upper: 2.5kg for 2-3 reps, lower: 5kg for 2-3 reps)
    await prisma.planProgressionRule.createMany({
      data: [
        // Upper body rules
        { planId, category: 'upper', minReps: 0, maxReps: 1, increase: 0 },
        { planId, category: 'upper', minReps: 2, maxReps: 3, increase: 2.5 },
        { planId, category: 'upper', minReps: 4, maxReps: 5, increase: 2.5 },
        { planId, category: 'upper', minReps: 6, maxReps: 99, increase: 5 },
        // Lower body rules
        { planId, category: 'lower', minReps: 0, maxReps: 1, increase: 0 },
        { planId, category: 'lower', minReps: 2, maxReps: 3, increase: 5 },
        { planId, category: 'lower', minReps: 4, maxReps: 5, increase: 5 },
        { planId, category: 'lower', minReps: 6, maxReps: 99, increase: 7.5 },
      ],
    });

    // Create day 1: Bench progression
    const day1 = await prisma.planDay.create({
      data: {
        planId,
        dayNumber: 1,
        name: 'Day 1',
      },
    });

    const day1Ex = await prisma.planDayExercise.create({
      data: {
        planDayId: day1.id,
        exerciseId: benchExId,
        tmExerciseId: benchExId,
        tier: 'T1',
        sortOrder: 1,
      },
    });

    // Create sets: one progression AMRAP at 95%
    await prisma.planSet.createMany({
      data: [
        { planDayExerciseId: day1Ex.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
        { planDayExerciseId: day1Ex.id, setOrder: 2, percentage: 0.85, reps: 3, isAmrap: false, isProgression: false },
        {
          planDayExerciseId: day1Ex.id,
          setOrder: 3,
          percentage: 0.95,
          reps: 1,
          isAmrap: true,
          isProgression: true,
        },
      ],
    });

    // Create day 2: Squat + Deadlift (multiple progression sets)
    const day2 = await prisma.planDay.create({
      data: {
        planId,
        dayNumber: 2,
        name: 'Day 2',
      },
    });

    const day2Ex1 = await prisma.planDayExercise.create({
      data: {
        planDayId: day2.id,
        exerciseId: squatExId,
        tmExerciseId: squatExId,
        tier: 'T1',
        sortOrder: 1,
      },
    });

    const day2Ex2 = await prisma.planDayExercise.create({
      data: {
        planDayId: day2.id,
        exerciseId: deadliftExId,
        tmExerciseId: deadliftExId,
        tier: 'T2',
        sortOrder: 2,
      },
    });

    // Squat sets: progression AMRAP at 95%
    await prisma.planSet.createMany({
      data: [
        { planDayExerciseId: day2Ex1.id, setOrder: 1, percentage: 0.75, reps: 5, isAmrap: false, isProgression: false },
        {
          planDayExerciseId: day2Ex1.id,
          setOrder: 2,
          percentage: 0.95,
          reps: 1,
          isAmrap: true,
          isProgression: true,
        },
      ],
    });

    // Deadlift sets: progression AMRAP at 90%
    await prisma.planSet.createMany({
      data: [
        { planDayExerciseId: day2Ex2.id, setOrder: 1, percentage: 0.7, reps: 5, isAmrap: false, isProgression: false },
        {
          planDayExerciseId: day2Ex2.id,
          setOrder: 2,
          percentage: 0.9,
          reps: 3,
          isAmrap: true,
          isProgression: true,
        },
      ],
    });

    // Subscribe user to plan
    await request(app)
      .post(`/api/plans/${planId}/subscribe`)
      .set('Authorization', `Bearer ${token}`);

    // Set up TMs using exercise IDs
    await request(app)
      .post('/api/training-maxes/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        exerciseTMs: [
          { exerciseId: benchExId, oneRepMax: 100 }, // TM = 90kg
          { exerciseId: squatExId, oneRepMax: 140 }, // TM = 126kg
          { exerciseId: deadliftExId, oneRepMax: 180 }, // TM = 162kg
          { exerciseId: ohpExId, oneRepMax: 60 }, // TM = 54kg
        ],
      });
  });

  async function startAndGetWorkout(dayNumber: number) {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token}`)
      .send({ dayNumber });
    return res.body;
  }

  async function logSetReps(workoutId: number, setId: number, reps: number) {
    await request(app)
      .patch(`/api/workouts/${workoutId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actualReps: reps, completed: true });
  }

  async function completeWorkout(workoutId: number) {
    const res = await request(app)
      .post(`/api/workouts/${workoutId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    return res.body;
  }

  describe('Single progression set with 3 reps (upper body)', () => {
    it('increases bench TM by 2.5kg', async () => {
      const workout = await startAndGetWorkout(1);

      // Find the progression set (95% AMRAP, setOrder=3)
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isAmrap: boolean; isProgression: boolean }) =>
          s.tier === 'T1' && s.setOrder === 3 && s.isProgression,
      );
      expect(progressionSet).toBeDefined();

      // Log 3 reps on progression set
      await logSetReps(workout.id, progressionSet.id, 3);

      // Complete workout
      const result = await completeWorkout(workout.id);

      expect(result.workout.status).toBe('completed');
      expect(result.progressions).toBeDefined();
      expect(Array.isArray(result.progressions)).toBe(true);
      expect(result.progressions).toHaveLength(1);

      const progression = result.progressions[0];
      expect(progression.exercise).toBe('Bench Press');
      expect(progression.previousTM).toBe(90);
      expect(progression.newTM).toBe(92.5);
      expect(progression.increase).toBe(2.5);

      // Verify TM was updated in DB
      const tmRes = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const benchTM = tmRes.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');
      expect(benchTM.weight).toBe(92.5);
    });
  });

  describe('Multiple progression sets (squat + deadlift)', () => {
    it('increases both TMs independently', async () => {
      const workout = await startAndGetWorkout(2);

      // Find progression sets
      const squatProgressionSet = workout.sets.find(
        (s: { exercise: string; isProgression: boolean }) => s.exercise === 'Squat' && s.isProgression,
      );
      const deadliftProgressionSet = workout.sets.find(
        (s: { exercise: string; isProgression: boolean }) => s.exercise === 'Deadlift' && s.isProgression,
      );

      expect(squatProgressionSet).toBeDefined();
      expect(deadliftProgressionSet).toBeDefined();

      // Log reps: squat 4 reps (lower body 4-5 = +5kg), deadlift 6 reps (lower body 6+ = +7.5kg)
      await logSetReps(workout.id, squatProgressionSet.id, 4);
      await logSetReps(workout.id, deadliftProgressionSet.id, 6);

      // Complete workout
      const result = await completeWorkout(workout.id);

      expect(result.workout.status).toBe('completed');
      expect(result.progressions).toBeDefined();
      expect(Array.isArray(result.progressions)).toBe(true);
      expect(result.progressions).toHaveLength(2);

      // Find progressions by exercise
      const squatProg = result.progressions.find((p: { exercise: string }) => p.exercise === 'Squat');
      const deadliftProg = result.progressions.find((p: { exercise: string }) => p.exercise === 'Deadlift');

      expect(squatProg).toBeDefined();
      expect(squatProg.previousTM).toBe(125); // 140 * 0.9 = 126, rounded to 125
      expect(squatProg.newTM).toBe(130);
      expect(squatProg.increase).toBe(5);

      expect(deadliftProg).toBeDefined();
      expect(deadliftProg.previousTM).toBe(162.5); // 180 * 0.9 = 162, rounded to 162.5
      expect(deadliftProg.newTM).toBe(170);
      expect(deadliftProg.increase).toBe(7.5);

      // Verify TMs were updated in DB
      const tmRes = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const squatTM = tmRes.body.find((tm: { exercise: string }) => tm.exercise === 'squat');
      const deadliftTM = tmRes.body.find((tm: { exercise: string }) => tm.exercise === 'deadlift');
      expect(squatTM.weight).toBe(130); // 125 + 5
      expect(deadliftTM.weight).toBe(170); // 162.5 + 7.5
    });
  });

  describe('Progression set with 0 reps', () => {
    it('does not increase TM (empty progressions array)', async () => {
      // Get current bench TM
      const tmBefore = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const benchBefore = tmBefore.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');

      const workout = await startAndGetWorkout(1);
      const progressionSet = workout.sets.find(
        (s: { tier: string; setOrder: number; isProgression: boolean }) => s.tier === 'T1' && s.isProgression,
      );

      // Log 0 reps
      await logSetReps(workout.id, progressionSet.id, 0);

      const result = await completeWorkout(workout.id);

      expect(result.workout.status).toBe('completed');
      expect(result.progressions).toBeDefined();
      expect(Array.isArray(result.progressions)).toBe(true);
      expect(result.progressions).toHaveLength(0); // No progression because 0 reps = 0 increase

      // Verify TM unchanged
      const tmAfter = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const benchAfter = tmAfter.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');
      expect(benchAfter.weight).toBe(benchBefore.weight);
    });
  });

  describe('Progression set without actualReps logged', () => {
    it('does not increase TM (empty progressions array)', async () => {
      const tmBefore = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const benchBefore = tmBefore.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');

      const workout = await startAndGetWorkout(1);

      // Complete without logging reps
      const result = await completeWorkout(workout.id);

      expect(result.workout.status).toBe('completed');
      expect(result.progressions).toHaveLength(0);

      // Verify TM unchanged
      const tmAfter = await request(app).get('/api/training-maxes').set('Authorization', `Bearer ${token}`);
      const benchAfter = tmAfter.body.find((tm: { exercise: string }) => tm.exercise === 'bench-press');
      expect(benchAfter.weight).toBe(benchBefore.weight);
    });
  });

  describe('TrainingMax row creation', () => {
    it('creates TM with both exercise string and exerciseId', async () => {
      const workout = await startAndGetWorkout(1);
      const progressionSet = workout.sets.find((s: { isProgression: boolean }) => s.isProgression);

      await logSetReps(workout.id, progressionSet.id, 5); // 5 reps = +2.5kg for upper body

      await completeWorkout(workout.id);

      // Fetch the newly created TM directly from DB
      const tm = await prisma.trainingMax.findFirst({
        where: { userId, exerciseId: benchExId },
        orderBy: { effectiveDate: 'desc' },
      });

      expect(tm).toBeDefined();
      expect(tm!.exerciseId).toBe(benchExId);
    });
  });
});
