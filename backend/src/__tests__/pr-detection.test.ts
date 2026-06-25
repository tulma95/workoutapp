import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser, getExercisesBySlug } from './helpers';

async function makeWorkout(
  userId: number,
  exerciseId: number,
  weight: number,
  reps: number,
  status: 'in_progress' | 'completed',
  completedAt: Date | null,
) {
  return prisma.workout.create({
    data: {
      userId,
      dayNumber: 1,
      status,
      completedAt,
      sets: {
        create: {
          exerciseId,
          exerciseOrder: 1,
          setOrder: 1,
          prescribedWeight: weight,
          prescribedReps: reps,
          actualReps: reps,
          completed: true,
          isAmrap: false,
          isProgression: false,
        },
      },
    },
  });
}

describe('PR detection on workout completion', () => {
  it('reports a new PR when this workout beats the prior best e1RM', async () => {
    const { user, token } = await createTestUser();
    const ex = await getExercisesBySlug(['bench-press']);
    const benchId = ex['bench-press']!.id;

    // Prior best: 80x5 -> e1RM ~93.3 (already completed).
    await makeWorkout(user.id, benchId, 80, 5, 'completed', new Date('2025-06-01T10:00:00Z'));
    // This workout: 80x8 -> e1RM ~101.3, beats the prior best.
    const w2 = await makeWorkout(user.id, benchId, 80, 8, 'in_progress', null);

    const res = await request(app)
      .post(`/api/workouts/${w2.id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const prs = res.body.newPRs as Array<{ slug: string; e1rm: number; previousE1rm: number }>;
    expect(prs).toHaveLength(1);
    expect(prs[0]!.slug).toBe('bench-press');
    expect(prs[0]!.e1rm).toBeCloseTo(101.33, 1);
    expect(prs[0]!.previousE1rm).toBeCloseTo(93.33, 1);
  });

  it('does not report a PR for a first-ever lift (nothing to beat)', async () => {
    const { user, token } = await createTestUser();
    const ex = await getExercisesBySlug(['squat']);
    const squatId = ex['squat']!.id;

    const w = await makeWorkout(user.id, squatId, 100, 5, 'in_progress', null);
    const res = await request(app)
      .post(`/api/workouts/${w.id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.newPRs).toEqual([]);
  });

  it('does not report a PR when this workout falls short of the prior best', async () => {
    const { user, token } = await createTestUser();
    const ex = await getExercisesBySlug(['deadlift']);
    const dlId = ex['deadlift']!.id;

    await makeWorkout(user.id, dlId, 150, 5, 'completed', new Date('2025-06-01T10:00:00Z')); // e1RM ~175
    const w2 = await makeWorkout(user.id, dlId, 150, 3, 'in_progress', null); // e1RM ~165

    const res = await request(app)
      .post(`/api/workouts/${w2.id}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.newPRs).toEqual([]);
  });
});
