import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function todayLocalMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Fresh user + a minimal plan whose upper-body progression rules give NO TM
// increase for 0-1 reps and +5 for 2+ reps, subscribed, with a bench TM whose
// effectiveDate is `tmDaysAgo` days ago.
async function setupStallScenario(tmEffectiveDate: Date) {
  const { user, token } = await createTestUser();
  const ex = await getExercisesBySlug(['bench-press']);
  const benchId = ex['bench-press']!.id;
  const uid = randomUUID().slice(0, 8);

  const plan = await prisma.workoutPlan.create({
    data: {
      slug: `stall-${uid}`,
      name: 'Stall Test Plan',
      description: 'x',
      daysPerWeek: 1,
      isPublic: false,
      isSystem: false,
      progressionRules: {
        create: [
          // Exercise-specific rule (matched first) for the failure band, plus a
          // category rule for the progressing band.
          { exerciseId: benchId, minReps: 0, maxReps: 1, increase: 0 },
          { category: 'upper', minReps: 2, maxReps: 30, increase: 5 },
        ],
      },
      days: {
        create: {
          dayNumber: 1,
          name: 'Day 1',
          exercises: {
            create: {
              exerciseId: benchId,
              tmExerciseId: benchId,
              sortOrder: 1,
              sets: { create: { setOrder: 1, percentage: 0.9, reps: 1, isAmrap: true, isProgression: true } },
            },
          },
        },
      },
    },
  });

  await prisma.userPlan.create({ data: { userId: user.id, planId: plan.id, isActive: true } });
  await prisma.trainingMax.create({
    data: { userId: user.id, exerciseId: benchId, weight: 100, effectiveDate: tmEffectiveDate },
  });

  return { user, token, benchId };
}

async function addSession(userId: number, benchId: number, actualReps: number, completedAt: Date) {
  await prisma.workout.create({
    data: {
      userId,
      dayNumber: 1,
      status: 'completed',
      completedAt,
      sets: {
        create: {
          exerciseId: benchId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedWeight: 90,
          prescribedReps: 1,
          isAmrap: true,
          isProgression: true,
          actualReps,
          completed: true,
        },
      },
    },
  });
}

// Dual-exercise setup: bench (upper) + squat (lower) with separate TMs.
async function setupDualExerciseScenario(tmEffectiveDate: Date) {
  const { user, token } = await createTestUser();
  const ex = await getExercisesBySlug(['bench-press', 'squat']);
  const benchId = ex['bench-press']!.id;
  const squatId = ex['squat']!.id;
  const uid = randomUUID().slice(0, 8);

  const plan = await prisma.workoutPlan.create({
    data: {
      slug: `dual-${uid}`,
      name: 'Dual Exercise Plan',
      description: 'x',
      daysPerWeek: 2,
      isPublic: false,
      isSystem: false,
      progressionRules: {
        create: [
          { category: 'upper', minReps: 0, maxReps: 1, increase: 0 },
          { category: 'upper', minReps: 2, maxReps: 30, increase: 5 },
          { category: 'lower', minReps: 0, maxReps: 1, increase: 0 },
          { category: 'lower', minReps: 2, maxReps: 30, increase: 5 },
        ],
      },
      days: {
        create: [
          {
            dayNumber: 1,
            name: 'Day 1',
            exercises: {
              create: {
                exerciseId: benchId,
                tmExerciseId: benchId,
                sortOrder: 1,
                sets: { create: { setOrder: 1, percentage: 0.9, reps: 1, isAmrap: true, isProgression: true } },
              },
            },
          },
          {
            dayNumber: 2,
            name: 'Day 2',
            exercises: {
              create: {
                exerciseId: squatId,
                tmExerciseId: squatId,
                sortOrder: 1,
                sets: { create: { setOrder: 1, percentage: 0.9, reps: 1, isAmrap: true, isProgression: true } },
              },
            },
          },
        ],
      },
    },
  });

  await prisma.userPlan.create({ data: { userId: user.id, planId: plan.id, isActive: true } });
  await prisma.trainingMax.create({
    data: { userId: user.id, exerciseId: benchId, weight: 100, effectiveDate: tmEffectiveDate },
  });
  await prisma.trainingMax.create({
    data: { userId: user.id, exerciseId: squatId, weight: 120, effectiveDate: tmEffectiveDate },
  });

  return { user, token, benchId, squatId };
}

describe('GET /api/training-maxes/stalls', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/training-maxes/stalls')).status).toBe(401);
  });

  it('flags a lift after 3 non-progressing AMRAP sessions, with a 10% deload', async () => {
    const { user, token, benchId } = await setupStallScenario(daysAgo(20));
    for (const d of [6, 4, 2]) await addSession(user.id, benchId, 0, daysAgo(d));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stalls).toHaveLength(1);
    expect(res.body.stalls[0]).toMatchObject({
      exerciseSlug: 'bench-press',
      currentTM: 100,
      suggestedTM: 90,
    });
  });

  it('does not flag with fewer than 3 sessions', async () => {
    const { user, token, benchId } = await setupStallScenario(daysAgo(20));
    for (const d of [4, 2]) await addSession(user.id, benchId, 0, daysAgo(d));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });

  it('does not flag when the lift is still progressing', async () => {
    const { user, token, benchId } = await setupStallScenario(daysAgo(20));
    for (const d of [6, 4, 2]) await addSession(user.id, benchId, 5, daysAgo(d)); // +5 each

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });

  it('does not flag when one of the last 3 sessions progressed', async () => {
    const { user, token, benchId } = await setupStallScenario(daysAgo(20));
    await addSession(user.id, benchId, 0, daysAgo(6)); // fail
    await addSession(user.id, benchId, 5, daysAgo(4)); // progressed (+5)
    await addSession(user.id, benchId, 0, daysAgo(2)); // fail

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });

  it('clears for a same-day deload (TM at local midnight, sessions earlier today)', async () => {
    // Mirrors the real apply: updateTM stores effectiveDate at local midnight,
    // while today's failing sessions have later timestamps. Day-granularity
    // comparison must still treat the deload as resolving the stall.
    const { user, token, benchId } = await setupStallScenario(todayLocalMidnight());
    for (let i = 0; i < 3; i++) await addSession(user.id, benchId, 0, new Date());

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });

  // ── Bounded-query correctness tests (ticket 187) ──────────────────────────
  // These cases verify that the ROW_NUMBER window query returns the same
  // stall verdict as the old fetch-all approach when there is a large history.

  it('detects stall correctly when most recent 3 sessions fail, preceded by many successes', async () => {
    // 20 progressing sessions (reps=5) followed by 3 failing sessions (reps=0).
    // The bounded query must select the 3 most-recent failing sessions, not the
    // older successful ones.
    const { user, token, benchId } = await setupStallScenario(daysAgo(100));
    // 20 old progressing sessions (days 50..11)
    for (let i = 0; i < 20; i++) {
      await addSession(user.id, benchId, 5, daysAgo(50 - i * 2));
    }
    // 3 recent stall sessions (days 6, 4, 2)
    for (const d of [6, 4, 2]) await addSession(user.id, benchId, 0, daysAgo(d));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stalls).toHaveLength(1);
    expect(res.body.stalls[0]).toMatchObject({
      exerciseSlug: 'bench-press',
      currentTM: 100,
      suggestedTM: 90,
    });
  });

  it('does not flag when the most recent session progressed, even with many older failures', async () => {
    // 10 failing sessions then 1 recent success — should not flag.
    const { user, token, benchId } = await setupStallScenario(daysAgo(60));
    for (let i = 0; i < 10; i++) {
      await addSession(user.id, benchId, 0, daysAgo(30 - i * 2));
    }
    // Most recent session: progressed
    await addSession(user.id, benchId, 5, daysAgo(1));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });

  it('only flags the stalled exercise when two exercises exist and only one stalls', async () => {
    // bench: 3 failing sessions => stall
    // squat: 3 progressing sessions => no stall
    const { user, token, benchId, squatId } = await setupDualExerciseScenario(daysAgo(30));

    for (const d of [6, 4, 2]) await addSession(user.id, benchId, 0, daysAgo(d));
    for (const d of [6, 4, 2]) await addSession(user.id, squatId, 5, daysAgo(d));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.stalls).toHaveLength(1);
    expect(res.body.stalls[0].exerciseSlug).toBe('bench-press');
  });

  it('does not flag either exercise when both have fewer than 3 sessions', async () => {
    const { user, token, benchId, squatId } = await setupDualExerciseScenario(daysAgo(30));

    // Only 2 sessions each
    for (const d of [4, 2]) await addSession(user.id, benchId, 0, daysAgo(d));
    for (const d of [4, 2]) await addSession(user.id, squatId, 0, daysAgo(d));

    const res = await request(app)
      .get('/api/training-maxes/stalls')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.stalls).toHaveLength(0);
  });
});
