import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

async function registerUser() {
  const id = randomUUID().slice(0, 8);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `prof-${id}@example.com`, password: 'password123', username: `prof${id}` });
  return {
    token: res.body.accessToken as string,
    userId: res.body.user.id as number,
    username: res.body.user.username as string,
  };
}

describe('GET /api/social/users/:username', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/social/users/someone')).status).toBe(401);
  });

  it('returns 404 for an unknown username', async () => {
    const a = await registerUser();
    const res = await request(app)
      .get('/api/social/users/nobody-xyz-123')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(404);
  });

  it('returns your own profile with isSelf true', async () => {
    const a = await registerUser();
    const res = await request(app)
      .get(`/api/social/users/${a.username}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.isSelf).toBe(true);
    expect(res.body.username).toBe(a.username);
    expect(res.body).toHaveProperty('currentStreak');
    expect(res.body).toHaveProperty('totalWorkouts');
    expect(res.body).toHaveProperty('achievementCount');
    expect(Array.isArray(res.body.topPRs)).toBe(true);
  });

  it("returns an accepted friend's profile (isSelf false)", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await prisma.friendship.create({
      data: { requesterId: a.userId, addresseeId: b.userId, status: 'accepted' },
    });
    const res = await request(app)
      .get(`/api/social/users/${b.username}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.isSelf).toBe(false);
    expect(res.body.username).toBe(b.username);
  });

  it('returns 403 when the target is not a friend', async () => {
    const a = await registerUser();
    const c = await registerUser();
    const res = await request(app)
      .get(`/api/social/users/${c.username}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(403);
  });

  it('does not expose a profile for a pending (not accepted) friendship', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await prisma.friendship.create({
      data: { requesterId: a.userId, addresseeId: b.userId, status: 'pending' },
    });
    const res = await request(app)
      .get(`/api/social/users/${b.username}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(403);
  });
});
