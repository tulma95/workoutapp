import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import prisma from '../../lib/db';
import { createTestUser, getExercisesBySlug } from '../helpers';

const uid = randomUUID().slice(0, 8);
let accessToken: string;

describe('User routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `userroute-${uid}@example.com`, password: 'password123', username: `userroute${uid}` });

    accessToken = res.body.accessToken;
  });

  describe('GET /api/users/me', () => {
    it('returns user without passwordHash', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', `userroute-${uid}@example.com`);
      expect(res.body).toHaveProperty('username', `userroute${uid}`);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('updates username', async () => {
      const newUsername = `updated${uid}`;
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: newUsername });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe(newUsername);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('PATCH /api/users/me/password', () => {
    async function newUser() {
      const id = randomUUID().slice(0, 8);
      const email = `pw-${id}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'original123', username: `pw${id}` });
      return { email, token: res.body.accessToken as string };
    }

    it('changes the password when the current password is correct', async () => {
      const { email, token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newPassword: 'brandnew456' });
      expect(res.status).toBe(204);

      // New password works, old one no longer does.
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'brandnew456' });
      expect(newLogin.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'original123' });
      expect(oldLogin.status).toBe(401);
    });

    it('rejects an incorrect current password with 400 and leaves the password unchanged', async () => {
      const { email, token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'brandnew456' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');

      // Original password still valid.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'original123' });
      expect(login.status).toBe(200);
    });

    it('rejects a too-short new password with 400', async () => {
      const { token } = await newUser();

      const res = await request(app)
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newPassword: 'short' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .patch('/api/users/me/password')
        .send({ currentPassword: 'original123', newPassword: 'brandnew456' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/users/me', () => {
    it('deletes the account and all owned data (incl. non-cascading rows), other users untouched', async () => {
      const { user, token } = await createTestUser({ password: 'todelete123' });
      const exercises = await getExercisesBySlug(['bench-press']);
      const benchId = exercises['bench-press']!.id;

      // Give the user rows whose User FK does NOT cascade, including a training
      // max that references a workout (the FK-ordering-sensitive case).
      const workout = await prisma.workout.create({
        data: {
          userId: user.id,
          dayNumber: 1,
          status: 'completed',
          completedAt: new Date(),
          sets: {
            create: {
              exerciseId: benchId,
              exerciseOrder: 1,
              setOrder: 1,
              prescribedWeight: 100,
              prescribedReps: 5,
              actualReps: 5,
              completed: true,
            },
          },
        },
      });
      await prisma.trainingMax.create({
        data: { userId: user.id, exerciseId: benchId, weight: 90, workoutId: workout.id },
      });

      const friend = await createTestUser();
      await prisma.friendship.create({
        data: { requesterId: user.id, addresseeId: friend.user.id, status: 'accepted' },
      });

      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'todelete123' });
      expect(res.status).toBe(204);

      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect(await prisma.trainingMax.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.workoutSet.count({ where: { workoutId: workout.id } })).toBe(0);
      expect(
        await prisma.friendship.count({
          where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
        }),
      ).toBe(0);
      // The other user is untouched.
      expect(await prisma.user.findUnique({ where: { id: friend.user.id } })).not.toBeNull();
    });

    it('rejects deletion with a wrong password (400) and keeps the account', async () => {
      const { user, token } = await createTestUser({ password: 'correct123' });

      const res = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrongpass' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
      expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).delete('/api/users/me').send({ password: 'x' });
      expect(res.status).toBe(401);
    });

    it('is idempotent: a repeated delete with the (still-valid) token returns 204', async () => {
      const { token } = await createTestUser({ password: 'todelete123' });

      const first = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'todelete123' });
      expect(first.status).toBe(204);

      // The JWT is stateless, so a replay still authenticates; the account is
      // already gone, which we treat as success rather than a 500.
      const second = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'todelete123' });
      expect(second.status).toBe(204);
    });
  });
});
