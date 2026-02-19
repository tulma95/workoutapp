import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

// Test against February 2026: starts on Sunday (getDay() = 0)
// Mondays (weekday 1): 2, 9, 16, 23
// Saturdays (weekday 6): 7, 14, 21, 28
// Sundays (weekday 0): 1, 8, 15, 22
const TEST_YEAR = 2026;
const TEST_MONTH = 2;

function monthDatesForWeekday(year: number, month: number, weekday: number): string[] {
  const dates: string[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDayNum = new Date(year, month, 0).getDate();
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  for (let d = 1 + offset; d <= lastDayNum; d += 7) {
    dates.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  return dates;
}

describe('GET /api/workouts/calendar - scheduledDays', () => {
  let token: string;
  let noPlanToken: string;
  let userId: number;
  let planId: number;
  let userPlanId: number;

  beforeAll(async () => {
    // Register user with active plan
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `cal-test-${uid}@example.com`,
        password: 'password123',
        displayName: 'Calendar Test',
      });
    token = res.body.accessToken;
    userId = res.body.user.id;

    // Register user with no plan
    const noPlanRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `cal-noplan-${uid}@example.com`,
        password: 'password123',
        displayName: 'Calendar No Plan',
      });
    noPlanToken = noPlanRes.body.accessToken;

    // Create a 4-day test plan
    const plan = await prisma.workoutPlan.create({
      data: {
        slug: `cal-plan-${uid}`,
        name: 'Calendar Test Plan',
        description: 'Test plan',
        daysPerWeek: 4,
        isPublic: true,
        isSystem: false,
      },
    });
    planId = plan.id;

    // Create PlanDays with names
    await prisma.planDay.createMany({
      data: [
        { planId, dayNumber: 1, name: 'Bench & OHP' },
        { planId, dayNumber: 2, name: 'Squat' },
        { planId, dayNumber: 3, name: 'Bench Heavy' },
        { planId, dayNumber: 4, name: 'Deadlift' },
      ],
    });

    // Subscribe user to the plan
    const userPlan = await prisma.userPlan.create({
      data: { userId, planId, isActive: true },
    });
    userPlanId = userPlan.id;
  });

  it('returns empty scheduledDays when user has no active plan', async () => {
    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${noPlanToken}`);

    expect(res.status).toBe(200);
    expect(res.body.scheduledDays).toEqual([]);
  });

  it('returns empty scheduledDays when plan has no schedule rows', async () => {
    // No schedule rows created yet for this userPlan
    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.scheduledDays).toEqual([]);
  });

  it('projects correct dates when schedule is set to Monday', async () => {
    // Day 1 = Monday (weekday 1)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 1, weekday: 1 },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const scheduledDates = res.body.scheduledDays.map(
      (d: { date: string }) => d.date,
    );
    const expectedDates = monthDatesForWeekday(TEST_YEAR, TEST_MONTH, 1);
    expect(scheduledDates.sort()).toEqual(expectedDates.sort());

    // Each entry has dayNumber and planDayName
    for (const entry of res.body.scheduledDays) {
      expect(entry.dayNumber).toBe(1);
      expect(entry.planDayName).toBe('Bench & OHP');
    }
  });

  it('excludes dates that already have a workout record from scheduledDays', async () => {
    // Day 1 = Monday (weekday 1)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 1, weekday: 1 },
    });

    const expectedDates = monthDatesForWeekday(TEST_YEAR, TEST_MONTH, 1);
    expect(expectedDates.length).toBeGreaterThan(0);

    // Pick the first Monday and create a workout on that date
    const firstMonday = expectedDates[0]!;
    const [fy, fm, fd] = firstMonday.split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const workoutDate = new Date(fy, fm - 1, fd, 12, 0, 0); // noon local time

    await prisma.workout.create({
      data: {
        userId,
        dayNumber: 1,
        status: 'completed',
        completedAt: workoutDate,
        createdAt: workoutDate,
      },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const scheduledDates = res.body.scheduledDays.map(
      (d: { date: string }) => d.date,
    );
    expect(scheduledDates).not.toContain(firstMonday);
    // Remaining Mondays should still be included
    for (const d of expectedDates.slice(1)) {
      expect(scheduledDates).toContain(d);
    }

    // Clean up: discard the workout we created
    await prisma.workout.updateMany({
      where: { userId, status: 'completed', completedAt: workoutDate },
      data: { status: 'discarded' },
    });
  });

  it('projects correct dates for Saturday schedule', async () => {
    // Day 2 = Saturday (weekday 6)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 2, weekday: 6 },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const scheduledDates = res.body.scheduledDays.map(
      (d: { date: string }) => d.date,
    );
    const expectedDates = monthDatesForWeekday(TEST_YEAR, TEST_MONTH, 6);
    expect(scheduledDates.sort()).toEqual(expectedDates.sort());
    for (const entry of res.body.scheduledDays) {
      expect(entry.dayNumber).toBe(2);
    }
  });

  it('projects correct dates for Sunday schedule', async () => {
    // Day 3 = Sunday (weekday 0)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 3, weekday: 0 },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const scheduledDates = res.body.scheduledDays.map(
      (d: { date: string }) => d.date,
    );
    const expectedDates = monthDatesForWeekday(TEST_YEAR, TEST_MONTH, 0);
    expect(scheduledDates.sort()).toEqual(expectedDates.sort());
  });

  it('does not include dates from previous or next month', async () => {
    // Day 1 = Monday (weekday 1)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 1, weekday: 1 },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const monthPrefix = `${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}-`;
    for (const entry of res.body.scheduledDays) {
      expect(entry.date).toMatch(new RegExp(`^${monthPrefix}`));
    }
  });

  it('excludes dates with discarded workouts from scheduledDays', async () => {
    // Day 1 = Monday (weekday 1)
    await prisma.userPlanSchedule.deleteMany({ where: { userPlanId } });
    await prisma.userPlanSchedule.create({
      data: { userPlanId, dayNumber: 1, weekday: 1 },
    });

    const expectedDates = monthDatesForWeekday(TEST_YEAR, TEST_MONTH, 1);
    const targetDate = expectedDates[0]!;
    const [fy, fm, fd] = targetDate.split('-').map(Number) as [number, number, number];
    const workoutDate = new Date(fy, fm - 1, fd, 12, 0, 0);

    // Create a discarded workout on that date
    await prisma.workout.create({
      data: {
        userId,
        dayNumber: 1,
        status: 'discarded',
        createdAt: workoutDate,
      },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const scheduledDates = res.body.scheduledDays.map(
      (d: { date: string }) => d.date,
    );
    // Discarded workout on targetDate still blocks it from scheduledDays
    expect(scheduledDates).not.toContain(targetDate);
  });

  it('includes planDayName as null when PlanDay has no name', async () => {
    // Create a plan with unnamed days
    const unnamedPlan = await prisma.workoutPlan.create({
      data: {
        slug: `cal-unnamed-${uid}`,
        name: 'Unnamed Days Plan',
        description: 'Plan with unnamed days',
        daysPerWeek: 2,
        isPublic: true,
        isSystem: false,
      },
    });
    // Create a day with null name
    await prisma.planDay.create({
      data: { planId: unnamedPlan.id, dayNumber: 1, name: null },
    });

    // Register a new user and subscribe
    const unnamedRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `cal-unnamed-${uid}@example.com`,
        password: 'password123',
        displayName: 'Unnamed Days User',
      });
    const unnamedToken: string = unnamedRes.body.accessToken;
    const unnamedUserId: number = unnamedRes.body.user.id;

    const up = await prisma.userPlan.create({
      data: { userId: unnamedUserId, planId: unnamedPlan.id, isActive: true },
    });
    await prisma.userPlanSchedule.create({
      data: { userPlanId: up.id, dayNumber: 1, weekday: 1 },
    });

    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${unnamedToken}`);

    expect(res.status).toBe(200);
    expect(res.body.scheduledDays.length).toBeGreaterThan(0);
    for (const entry of res.body.scheduledDays) {
      expect(entry.planDayName).toBeNull();
    }
  });

  it('returns workouts array alongside scheduledDays', async () => {
    const res = await request(app)
      .get(`/api/workouts/calendar?year=${TEST_YEAR}&month=${TEST_MONTH}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workouts)).toBe(true);
    expect(Array.isArray(res.body.scheduledDays)).toBe(true);
  });
});
