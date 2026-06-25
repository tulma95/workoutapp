import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/db';
import { createTestUser } from './helpers';

function makeWorkout(userId: number) {
  return prisma.workout.create({
    data: { userId, dayNumber: 1, status: 'completed', completedAt: new Date() },
  });
}

describe('Workout notes', () => {
  it('requires authentication', async () => {
    const res = await request(app).patch('/api/workouts/1/notes').send({ notes: 'hi' });
    expect(res.status).toBe(401);
  });

  it('sets a (trimmed) note and returns it on the workout', async () => {
    const { user, token } = await createTestUser();
    const w = await makeWorkout(user.id);

    const set = await request(app)
      .patch(`/api/workouts/${w.id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: '  Felt strong today  ' });
    expect(set.status).toBe(200);
    expect(set.body.notes).toBe('Felt strong today');

    const fetched = await request(app)
      .get(`/api/workouts/${w.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.body.notes).toBe('Felt strong today');
  });

  it('clears the note when given a blank string', async () => {
    const { user, token } = await createTestUser();
    const w = await makeWorkout(user.id);
    await request(app)
      .patch(`/api/workouts/${w.id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'something' });

    const cleared = await request(app)
      .patch(`/api/workouts/${w.id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: '   ' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.notes).toBeNull();
  });

  it('rejects notes over the length limit', async () => {
    const { user, token } = await createTestUser();
    const w = await makeWorkout(user.id);
    const res = await request(app)
      .patch(`/api/workouts/${w.id}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("won't update another user's workout", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const w = await makeWorkout(owner.user.id);
    const res = await request(app)
      .patch(`/api/workouts/${w.id}/notes`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ notes: 'hi' });
    expect(res.status).toBe(404);
  });
});
