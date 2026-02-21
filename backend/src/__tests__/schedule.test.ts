import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('Schedule API', () => {
  let token: string;
  let noPlanToken: string;
  let planId: number;

  beforeAll(async () => {
    // Register user with active plan
    const res = await request(app).post('/api/auth/register').send({
      email: `schedule-${uid}@example.com`,
      password: 'password123',
      username: `schedule_${uid}`,
    });
    token = res.body.accessToken;
    const userId: number = res.body.user.id;

    // Register user without a plan
    const noPlanRes = await request(app).post('/api/auth/register').send({
      email: `schedule-noplan-${uid}@example.com`,
      password: 'password123',
      username: `schedule_noplan_${uid}`,
    });
    noPlanToken = noPlanRes.body.accessToken;

    // Create a 4-day test plan
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `schedule-plan-${uid}`,
        name: 'Schedule Test Plan',
        description: 'Test plan for schedule tests',
        daysPerWeek: 4,
        isPublic: true,
        isSystem: false,
      },
    });
    planId = plan.id;

    // Subscribe user to the plan
    await prisma.userPlan.create({
      data: {
        userId,
        planId,
        isActive: true,
      },
    });
  });

  describe('GET /api/schedule', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/schedule');
      expect(res.status).toBe(401);
    });

    it('returns empty schedule when no active plan', async () => {
      const res = await request(app)
        .get('/api/schedule')
        .set('Authorization', `Bearer ${noPlanToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ schedule: [] });
    });

    it('returns empty schedule when plan has no rows', async () => {
      const res = await request(app)
        .get('/api/schedule')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ schedule: [] });
    });

    it('returns schedule rows after PUT', async () => {
      // First set a schedule
      await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [
            { dayNumber: 1, weekday: 1 },
            { dayNumber: 2, weekday: 3 },
          ],
        });

      const res = await request(app)
        .get('/api/schedule')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.schedule).toHaveLength(2);
      expect(res.body.schedule).toEqual(
        expect.arrayContaining([
          { dayNumber: 1, weekday: 1 },
          { dayNumber: 2, weekday: 3 },
        ])
      );
    });
  });

  describe('PUT /api/schedule', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .send({ schedule: [{ dayNumber: 1, weekday: 1 }] });
      expect(res.status).toBe(401);
    });

    it('saves schedule and returns it (happy path)', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [
            { dayNumber: 1, weekday: 2 },
            { dayNumber: 3, weekday: 4 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.schedule).toHaveLength(2);
      expect(res.body.schedule).toEqual(
        expect.arrayContaining([
          { dayNumber: 1, weekday: 2 },
          { dayNumber: 3, weekday: 4 },
        ])
      );
    });

    it('replaces existing rows (does not append)', async () => {
      // First PUT
      await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [
            { dayNumber: 1, weekday: 1 },
            { dayNumber: 2, weekday: 2 },
            { dayNumber: 3, weekday: 3 },
          ],
        });

      // Second PUT with different rows
      const putRes = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [{ dayNumber: 4, weekday: 5 }],
        });

      expect(putRes.status).toBe(200);

      // GET should only return the second PUT's rows
      const getRes = await request(app)
        .get('/api/schedule')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.body.schedule).toHaveLength(1);
      expect(getRes.body.schedule[0]).toEqual({ dayNumber: 4, weekday: 5 });
    });

    it('clears all rows when given empty schedule: []', async () => {
      // First add some rows
      await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [{ dayNumber: 1, weekday: 1 }],
        });

      // Then clear
      const putRes = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({ schedule: [] });

      expect(putRes.status).toBe(200);
      expect(putRes.body.schedule).toEqual([]);

      const getRes = await request(app)
        .get('/api/schedule')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.body.schedule).toEqual([]);
    });

    it('returns 400 for invalid weekday (7)', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [{ dayNumber: 1, weekday: 7 }],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 for dayNumber exceeding plan daysPerWeek (4)', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [{ dayNumber: 5, weekday: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 for duplicate dayNumbers in body', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${token}`)
        .send({
          schedule: [
            { dayNumber: 1, weekday: 1 },
            { dayNumber: 1, weekday: 3 },
          ],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when user has no active plan', async () => {
      const res = await request(app)
        .put('/api/schedule')
        .set('Authorization', `Bearer ${noPlanToken}`)
        .send({
          schedule: [{ dayNumber: 1, weekday: 1 }],
        });

      expect(res.status).toBe(400);
    });
  });
});
