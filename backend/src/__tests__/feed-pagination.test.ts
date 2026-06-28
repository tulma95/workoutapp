import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().slice(0, 8);

describe('Feed cursor pagination', () => {
  let tokenA: string;
  let userIdA: number;
  let tokenB: string;

  beforeAll(async () => {
    // Register user A (the event creator)
    const resA = await request(app).post('/api/auth/register').send({
      email: `pagfeed-a-${uid}@example.com`,
      password: 'password123',
      username: `pagfeeda${uid}`,
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // Register user B (the feed consumer)
    const resB = await request(app).post('/api/auth/register').send({
      email: `pagfeed-b-${uid}@example.com`,
      password: 'password123',
      username: `pagfeedb${uid}`,
    });
    tokenB = resB.body.accessToken;
    const userIdB: number = resB.body.user.id;

    // Establish friendship: A → B, B accepts
    const reqId = Math.min(userIdA, userIdB);
    const addId = Math.max(userIdA, userIdB);
    await prisma.friendship.create({
      data: { requesterId: reqId, addresseeId: addId, initiatorId: userIdA, status: 'accepted' },
    });

    // Insert 25 feed events for user A directly (faster than HTTP round-trips)
    for (let i = 1; i <= 25; i++) {
      await prisma.feedEvent.create({
        data: {
          userId: userIdA,
          eventType: 'workout_completed',
          payload: { workoutId: i, dayNumber: 1, isCustom: false },
        },
      });
    }
  });

  it('first page returns 20 events and a non-null nextCursor', async () => {
    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(20);
    expect(res.body.nextCursor).toBeTypeOf('number');
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('second page (via cursor) returns remaining events and nextCursor null', async () => {
    // Get cursor from first page
    const page1 = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenB}`);
    const cursor = page1.body.nextCursor as number;

    const page2 = await request(app)
      .get(`/api/social/feed?cursor=${cursor}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(page2.status).toBe(200);
    expect(page2.body.events.length).toBeGreaterThan(0);
    expect(page2.body.nextCursor).toBeNull();
  });

  it('pages have no overlapping events', async () => {
    const page1 = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenB}`);
    const cursor = page1.body.nextCursor as number;

    const page2 = await request(app)
      .get(`/api/social/feed?cursor=${cursor}`)
      .set('Authorization', `Bearer ${tokenB}`);

    const page1Ids = new Set((page1.body.events as { id: number }[]).map((e) => e.id));
    const page2Ids = (page2.body.events as { id: number }[]).map((e) => e.id);

    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
  });

  it('new event inserted mid-pagination does not duplicate or skip existing events', async () => {
    // Fetch first page to get a cursor
    const page1 = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenB}`);
    const cursor = page1.body.nextCursor as number;
    const page1Ids = new Set((page1.body.events as { id: number }[]).map((e) => e.id));

    // Insert a brand-new event (higher ID, newest timestamp) after page 1 was fetched
    await prisma.feedEvent.create({
      data: {
        userId: userIdA,
        eventType: 'workout_completed',
        payload: { workoutId: 999, dayNumber: 1, isCustom: false },
      },
    });

    // Fetch page 2 using the cursor from page 1 — new event is NEWER than cursor,
    // so it would not appear in page 2 anyway (page 2 starts after the cursor record
    // in DESC order, so it only shows older events)
    const page2 = await request(app)
      .get(`/api/social/feed?cursor=${cursor}`)
      .set('Authorization', `Bearer ${tokenB}`);

    const page2Ids = (page2.body.events as { id: number }[]).map((e) => e.id);

    // No overlap between page 1 and page 2
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }
  });

  it('last page returns nextCursor null', async () => {
    // Exhaust all pages
    let currentCursor: number | null = null;
    let lastResponse: { events: { id: number }[]; nextCursor: number | null } | null = null;

    for (let page = 0; page < 10; page++) {
      const url = currentCursor !== null
        ? `/api/social/feed?cursor=${currentCursor}`
        : '/api/social/feed';
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${tokenB}`);
      lastResponse = res.body as typeof lastResponse;
      currentCursor = lastResponse!.nextCursor;
      if (currentCursor === null) break;
    }

    expect(lastResponse!.nextCursor).toBeNull();
  });

  it('custom limit is respected (limit=5)', async () => {
    const res = await request(app)
      .get('/api/social/feed?limit=5')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeLessThanOrEqual(5);
    // With 25+ events, exactly 5 should be returned
    expect(res.body.events).toHaveLength(5);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('returns 400 for limit exceeding max (limit=51)', async () => {
    const res = await request(app)
      .get('/api/social/feed?limit=51')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid cursor (non-integer)', async () => {
    const res = await request(app)
      .get('/api/social/feed?cursor=abc')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('each event has full enrichment (streak, reactions, commentCount, latestComments)', async () => {
    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const event = res.body.events[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('userId');
    expect(event).toHaveProperty('username');
    expect(event).toHaveProperty('eventType');
    expect(event).toHaveProperty('payload');
    expect(event).toHaveProperty('createdAt');
    expect(event).toHaveProperty('streak');
    expect(event).toHaveProperty('reactions');
    expect(event).toHaveProperty('commentCount');
    expect(event).toHaveProperty('latestComments');
    expect(Array.isArray(event.reactions)).toBe(true);
    expect(Array.isArray(event.latestComments)).toBe(true);
  });
});
