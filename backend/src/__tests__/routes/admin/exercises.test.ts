import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import prisma from '../../../lib/db';
import bcrypt from 'bcrypt';

let adminToken: string;
let nonAdminToken: string;
let testExerciseId: number;

describe('Admin Exercise routes', () => {
  beforeAll(async () => {
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        displayName: 'Admin User',
        unitPreference: 'kg',
        isAdmin: true,
      },
    });

    // Create non-admin user
    const nonAdminUser = await prisma.user.create({
      data: {
        email: 'nonadmin@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        displayName: 'Non-Admin User',
        unitPreference: 'kg',
        isAdmin: false,
      },
    });

    // Login as admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminToken = adminLoginRes.body.accessToken;

    // Login as non-admin
    const nonAdminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonadmin@example.com', password: 'password123' });
    nonAdminToken = nonAdminLoginRes.body.accessToken;
  });

  describe('POST /api/admin/exercises', () => {
    it('creates exercise successfully as admin', async () => {
      const res = await request(app)
        .post('/api/admin/exercises')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'test-exercise',
          name: 'Test Exercise',
          muscleGroup: 'chest',
          category: 'compound',
          isUpperBody: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.slug).toBe('test-exercise');
      expect(res.body.name).toBe('Test Exercise');
      testExerciseId = res.body.id;
    });

    it('returns 409 for duplicate slug', async () => {
      const res = await request(app)
        .post('/api/admin/exercises')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'test-exercise',
          name: 'Duplicate Exercise',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .post('/api/admin/exercises')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          slug: 'forbidden-exercise',
          name: 'Forbidden Exercise',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/admin/exercises')
        .send({
          slug: 'no-auth-exercise',
          name: 'No Auth Exercise',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/exercises', () => {
    it('lists all exercises ordered by name', async () => {
      const res = await request(app)
        .get('/api/admin/exercises')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify ordering by name
      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i].name >= res.body[i - 1].name).toBe(true);
      }
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .get('/api/admin/exercises')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PATCH /api/admin/exercises/:id', () => {
    it('updates exercise successfully', async () => {
      const res = await request(app)
        .patch(`/api/admin/exercises/${testExerciseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Exercise',
          muscleGroup: 'back',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Test Exercise');
      expect(res.body.muscleGroup).toBe('back');
      expect(res.body.slug).toBe('test-exercise'); // unchanged
    });

    it('returns 404 for non-existent exercise', async () => {
      const res = await request(app)
        .patch('/api/admin/exercises/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .patch(`/api/admin/exercises/${testExerciseId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          name: 'Forbidden Update',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/admin/exercises/:id', () => {
    it('returns 409 when exercise is referenced by plan', async () => {
      // Create an exercise and reference it in a plan
      const referencedExercise = await prisma.exercise.create({
        data: {
          slug: 'referenced-exercise',
          name: 'Referenced Exercise',
          category: 'compound',
        },
      });

      // Create a plan that references the exercise
      const plan = await prisma.workoutPlan.create({
        data: {
          slug: 'test-plan',
          name: 'Test Plan',
          daysPerWeek: 1,
        },
      });

      const planDay = await prisma.planDay.create({
        data: {
          planId: plan.id,
          dayNumber: 1,
        },
      });

      await prisma.planDayExercise.create({
        data: {
          planDayId: planDay.id,
          exerciseId: referencedExercise.id,
          tmExerciseId: referencedExercise.id,
          tier: 'T1',
          sortOrder: 1,
        },
      });

      const res = await request(app)
        .delete(`/api/admin/exercises/${referencedExercise.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('deletes unreferenced exercise successfully', async () => {
      const res = await request(app)
        .delete(`/api/admin/exercises/${testExerciseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify it's deleted
      const getRes = await request(app)
        .get('/api/admin/exercises')
        .set('Authorization', `Bearer ${adminToken}`);

      const found = getRes.body.find((e: any) => e.id === testExerciseId);
      expect(found).toBeUndefined();
    });

    it('returns 404 for non-existent exercise', async () => {
      const res = await request(app)
        .delete('/api/admin/exercises/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app)
        .delete(`/api/admin/exercises/${testExerciseId}`)
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
