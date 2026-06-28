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
      // Returns 200 with fresh tokens so the current session stays authenticated
      // after old tokens are invalidated by the tokenVersion bump.
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

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

  describe('PATCH /api/users/me/email', () => {
    async function newUser() {
      const id = randomUUID().slice(0, 8);
      const email = `em-${id}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'original123', username: `em${id}` });
      return { id, email, token: res.body.accessToken as string };
    }

    it('changes the email when the password is correct', async () => {
      const { id, token } = await newUser();
      const newEmail = `em-new-${id}@example.com`;

      const res = await request(app)
        .patch('/api/users/me/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newEmail });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(newEmail);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: newEmail, password: 'original123' });
      expect(login.status).toBe(200);
    });

    it('rejects an incorrect password with 400', async () => {
      const { id, token } = await newUser();
      const res = await request(app)
        .patch('/api/users/me/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpassword', newEmail: `em-x-${id}@example.com` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('rejects an email already in use with 409', async () => {
      const a = await newUser();
      const b = await newUser();
      const res = await request(app)
        .patch('/api/users/me/email')
        .set('Authorization', `Bearer ${b.token}`)
        .send({ currentPassword: 'original123', newEmail: a.email });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('rejects an invalid email format with 400', async () => {
      const { token } = await newUser();
      const res = await request(app)
        .patch('/api/users/me/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'original123', newEmail: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app)
        .patch('/api/users/me/email')
        .send({ currentPassword: 'original123', newEmail: 'x@example.com' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/me/export', () => {
    it('returns the user profile and owned data as JSON', async () => {
      const { user, token } = await createTestUser();
      const exercises = await getExercisesBySlug(['bench-press']);
      const benchId = exercises['bench-press']!.id;

      await prisma.trainingMax.create({
        data: { userId: user.id, exerciseId: benchId, weight: 90 },
      });
      await prisma.workout.create({
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
              actualReps: 6,
              completed: true,
            },
          },
        },
      });

      // Social data the user authored — must be in a GDPR export.
      const friend = await createTestUser();
      await prisma.friendship.create({
        data: { requesterId: user.id, addresseeId: friend.user.id, status: 'accepted' },
      });
      const event = await prisma.feedEvent.create({
        data: { userId: user.id, eventType: 'workout_completed', payload: { day: 1 } },
      });
      await prisma.feedEventComment.create({
        data: { feedEventId: event.id, userId: user.id, text: 'great session' },
      });

      const res = await request(app)
        .get('/api/users/me/export')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('setforge-export.json');
      expect(res.body.profile.email).toBe(user.email);
      expect(res.body.profile).not.toHaveProperty('passwordHash');
      expect(res.body.trainingMaxes).toContainEqual(
        expect.objectContaining({ exercise: 'bench-press', weight: 90 }),
      );
      expect(res.body.workouts).toHaveLength(1);
      expect(res.body.workouts[0].sets[0]).toMatchObject({
        exercise: 'bench-press',
        prescribedWeight: 100,
        actualReps: 6,
      });
      // Authored social data is included.
      expect(res.body.friendships).toContainEqual(
        expect.objectContaining({ status: 'accepted' }),
      );
      expect(res.body.feedComments).toContainEqual(
        expect.objectContaining({ text: 'great session' }),
      );
      expect(res.body.feedEvents.length).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.exportedAt).toBe('string');
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/users/me/export');
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

    it('is idempotent: a repeated delete with the same token returns 401 (user gone from DB)', async () => {
      const { token } = await createTestUser({ password: 'todelete123' });

      const first = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'todelete123' });
      expect(first.status).toBe(204);

      // With tokenVersion checking the auth middleware now looks up the user in
      // DB on every request. Once the account is deleted there is no row to
      // compare the tokenVersion against, so the middleware rejects the replay
      // with 401 before the route handler is reached.
      const second = await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'todelete123' });
      expect(second.status).toBe(401);
    });
  });
});
