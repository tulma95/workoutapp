import { describe, it, expect, beforeAll } from 'vitest';
import { EventEmitter } from 'events';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';
import { NotificationPayload } from '../services/notifications.service';

const uid = randomUUID().slice(0, 8);

// Minimal mock of Express Response for in-process testing
function makeMockRes() {
  const emitter = new EventEmitter();
  const written: string[] = [];
  const res = {
    write: (chunk: string) => { written.push(chunk); },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return res;
    },
    emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
    written,
  };
  return res;
}

describe('NotificationManager', () => {
  // Import a fresh instance for each describe block
  // Since it's a singleton, we test using the exported instance
  let notificationManager: Awaited<typeof import('../services/notifications.service')>['notificationManager'];

  beforeAll(async () => {
    const mod = await import('../services/notifications.service');
    notificationManager = mod.notificationManager;
  });

  describe('connect/disconnect lifecycle', () => {
    it('registers a connection and removes it on close', () => {
      const mockRes = makeMockRes();
      notificationManager.connect(9001, mockRes as never);

      // Connection is live — notifyUser should write data
      const payload: NotificationPayload = { type: 'workout_completed', message: 'test' };
      notificationManager.notifyUser(9001, payload);
      expect(mockRes.written.length).toBe(1);
      expect(mockRes.written[0]).toContain('"type":"workout_completed"');

      // Simulate client disconnect
      mockRes.emit('close');

      // After close, notifyUser should not write
      notificationManager.notifyUser(9001, payload);
      expect(mockRes.written.length).toBe(1); // still 1, no new writes
    });
  });

  describe('multiple connections per user', () => {
    it('delivers events to all open connections for a user', () => {
      const resA = makeMockRes();
      const resB = makeMockRes();
      notificationManager.connect(9002, resA as never);
      notificationManager.connect(9002, resB as never);

      const payload: NotificationPayload = { type: 'achievement_earned', message: 'badge' };
      notificationManager.notifyUser(9002, payload);

      expect(resA.written.length).toBe(1);
      expect(resB.written.length).toBe(1);

      // Cleanup
      resA.emit('close');
      resB.emit('close');
    });

    it('continues delivering to remaining connections after one closes', () => {
      const resA = makeMockRes();
      const resB = makeMockRes();
      notificationManager.connect(9003, resA as never);
      notificationManager.connect(9003, resB as never);

      resA.emit('close');

      const payload: NotificationPayload = { type: 'workout_completed', message: 'done' };
      notificationManager.notifyUser(9003, payload);

      expect(resA.written.length).toBe(0);
      expect(resB.written.length).toBe(1);

      // Cleanup
      resB.emit('close');
    });
  });

  describe('notifyFriends', () => {
    let userAId: number;
    let userBId: number; // accepted friend
    let userCId: number; // pending only (not accepted)
    let userDId: number; // stranger

    beforeAll(async () => {
      const resA = await request(app).post('/api/auth/register').send({
        email: `notif-a-${uid}@example.com`,
        password: 'password123',
        username: `notif_a_${uid}`,
      });
      userAId = resA.body.user.id;

      const resB = await request(app).post('/api/auth/register').send({
        email: `notif-b-${uid}@example.com`,
        password: 'password123',
        username: `notif_b_${uid}`,
      });
      userBId = resB.body.user.id;

      const resC = await request(app).post('/api/auth/register').send({
        email: `notif-c-${uid}@example.com`,
        password: 'password123',
        username: `notif_c_${uid}`,
      });
      userCId = resC.body.user.id;

      await request(app).post('/api/auth/register').send({
        email: `notif-d-${uid}@example.com`,
        password: 'password123',
        username: `notif_d_${uid}`,
      }).then((r) => { userDId = r.body.user.id; });

      // Create accepted friendship between A and B
      const requesterId = Math.min(userAId, userBId);
      const addresseeId = Math.max(userAId, userBId);
      await prisma.friendship.create({
        data: { requesterId, addresseeId, initiatorId: userAId, status: 'accepted' },
      });

      // Create pending friendship between A and C (not accepted)
      const requesterIdAC = Math.min(userAId, userCId);
      const addresseeIdAC = Math.max(userAId, userCId);
      await prisma.friendship.create({
        data: { requesterId: requesterIdAC, addresseeId: addresseeIdAC, initiatorId: userAId, status: 'pending' },
      });

      // D is a stranger — no friendship with A
      void userDId;
    });

    it('only notifies accepted friends, not self, not pending, not strangers', async () => {
      const resB = makeMockRes();
      const resC = makeMockRes();
      const resD = makeMockRes();
      const resSelf = makeMockRes();

      notificationManager.connect(userBId, resB as never);
      notificationManager.connect(userCId, resC as never);
      notificationManager.connect(userDId, resD as never);
      notificationManager.connect(userAId, resSelf as never);

      const payload: NotificationPayload = { type: 'workout_completed', message: 'A finished' };
      await notificationManager.notifyFriends(userAId, payload);

      expect(resB.written.length).toBe(1); // accepted friend receives notification
      expect(resC.written.length).toBe(0); // pending friend does NOT receive
      expect(resD.written.length).toBe(0); // stranger does NOT receive
      expect(resSelf.written.length).toBe(0); // self does NOT receive

      // Cleanup
      resB.emit('close');
      resC.emit('close');
      resD.emit('close');
      resSelf.emit('close');
    });
  });
});

describe('GET /api/notifications/stream', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/notifications/stream');
    expect(res.status).toBe(401);
  });
});
