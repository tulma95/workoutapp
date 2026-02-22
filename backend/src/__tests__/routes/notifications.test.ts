import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import prisma from '../../lib/db';

const uid = randomUUID().slice(0, 8);
let accessToken: string;
let userId: number;

const testEndpoint = `https://push.example.com/sub/${uid}`;
const testKeys = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtZ5SBNXJ1clk9I7kAuikGBGEzg4wjlXiIh4ug',
  auth: 'tBHItJI5svbpez7KI4CCXg',
};

describe('Notification push routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `notif-${uid}@example.com`,
        password: 'password123',
        username: `notif${uid}`,
      });

    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  describe('GET /api/notifications/public-key', () => {
    it('returns VAPID public key without auth', async () => {
      const res = await request(app).get('/api/notifications/public-key');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('publicKey');
      expect(typeof res.body.publicKey).toBe('string');
      expect(res.body.publicKey.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/notifications/subscribe', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/notifications/subscribe')
        .send({ endpoint: testEndpoint, keys: testKeys });

      expect(res.status).toBe(401);
    });

    it('stores subscription row', async () => {
      const res = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: testEndpoint, keys: testKeys });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);

      const row = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint: testEndpoint },
      });
      expect(row).not.toBeNull();
      expect(row?.p256dh).toBe(testKeys.p256dh);
      expect(row?.auth).toBe(testKeys.auth);
    });

    it('upserts on duplicate endpoint (updates keys)', async () => {
      const updatedKeys = {
        p256dh: 'UPDATED_BNcRdreALRFXTkOOUHK1EtK2wtZ5SBNXJ1clk9I7kAuikGBGEzg4wjlX',
        auth: 'UPDATED_tBHItJI5svbpez7KI4CCXg',
      };

      const res = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: testEndpoint, keys: updatedKeys });

      expect(res.status).toBe(201);

      const rows = await prisma.pushSubscription.findMany({
        where: { userId, endpoint: testEndpoint },
      });
      // Should only have one row (upserted, not duplicated)
      expect(rows).toHaveLength(1);
      expect(rows[0]?.p256dh).toBe(updatedKeys.p256dh);
      expect(rows[0]?.auth).toBe(updatedKeys.auth);
    });

    it('returns 400 for missing keys', async () => {
      const res = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: testEndpoint });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/notifications/subscribe', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .delete('/api/notifications/subscribe')
        .send({ endpoint: testEndpoint });

      expect(res.status).toBe(401);
    });

    it('deletes existing subscription row', async () => {
      // Ensure subscription exists first
      await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: testEndpoint, keys: testKeys });

      const res = await request(app)
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: testEndpoint });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const row = await prisma.pushSubscription.findFirst({
        where: { userId, endpoint: testEndpoint },
      });
      expect(row).toBeNull();
    });

    it('returns 404 when subscription does not exist', async () => {
      const missingEndpoint = `https://push.example.com/missing/${uid}`;

      const res = await request(app)
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endpoint: missingEndpoint });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
