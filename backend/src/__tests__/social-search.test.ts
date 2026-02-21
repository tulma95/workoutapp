import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';
import prisma from '../lib/db';

const uid = randomUUID().replace(/-/g, '').slice(0, 10);

async function registerUser(opts: { email: string; password: string; username: string }) {
  const res = await request(app).post('/api/auth/register').send(opts);
  return { token: res.body.accessToken as string, userId: res.body.user.id as number };
}

async function createFriendship(
  tokenA: string,
  emailB: string,
  accept = false,
  tokenB?: string
) {
  const res = await request(app)
    .post('/api/social/request')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ email: emailB });
  if (accept && tokenB && res.body.id) {
    await request(app)
      .patch(`/api/social/requests/${res.body.id}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);
  }
  return res.body.id as number;
}

async function declineFriendship(friendshipId: number, token: string) {
  await request(app)
    .patch(`/api/social/requests/${friendshipId}/decline`)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/social/search', () => {
  let callerToken: string;
  let callerEmail: string;

  // Users with usernames for searching
  let userAlpha: { token: string; userId: number; email: string };

  beforeAll(async () => {
    // Register the caller (no username)
    callerEmail = `search-caller-${uid}@example.com`;
    const caller = await registerUser({
      email: callerEmail,
      password: 'password123',
      username: `caller_${uid}`,
    });
    callerToken = caller.token;

    // Register users with searchable usernames
    const emailAlpha = `search-alpha-${uid}@example.com`;
    const alpha = await registerUser({
      email: emailAlpha,
      password: 'password123',
      username: `alpha_${uid}`,
    });
    userAlpha = { ...alpha, email: emailAlpha };

    await registerUser({
      email: `search-beta-${uid}@example.com`,
      password: 'password123',
      username: `beta_${uid}`,
    });

    // Register gamma user (no variable needed - just to populate search results)
    await registerUser({
      email: `search-gamma-${uid}@example.com`,
      password: 'password123',
      username: `gamma_${uid}`,
    });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/social/search?q=alpha');
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(app)
      .get('/api/social/search')
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_QUERY');
  });

  it('returns 400 when q is empty string', async () => {
    const res = await request(app)
      .get('/api/social/search?q=')
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(400);
  });

  it('returns matching users by username substring', async () => {
    const res = await request(app)
      .get(`/api/social/search?q=alpha_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].username).toBe(`alpha_${uid}`);
    expect(res.body.users[0]).toHaveProperty('id');
  });

  it('returns id, username fields', async () => {
    const res = await request(app)
      .get(`/api/social/search?q=alpha_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const user = res.body.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    // Should not include email or password hash
    expect(user).not.toHaveProperty('email');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('excludes the caller from results', async () => {
    const res = await request(app)
      .get(`/api/social/search?q=caller_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).not.toContain(
      (await prisma.user.findFirst({ where: { email: callerEmail } }))?.id
    );
  });

  it('excludes users with pending friend request', async () => {
    // Register a new user and send a pending request
    const pendingEmail = `search-pending-${uid}@example.com`;
    const pendingUser = await registerUser({
      email: pendingEmail,
      password: 'password123',
      username: `pending_${uid}`,
    });
    // Caller sends request to pending user (not accepted)
    await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${callerToken}`)
      .send({ email: pendingEmail });

    const res = await request(app)
      .get(`/api/social/search?q=pending_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).not.toContain(pendingUser.userId);
  });

  it('excludes users with pending request sent TO caller', async () => {
    // Register a new user who sends a request to the caller
    const inboundEmail = `search-inbound-${uid}@example.com`;
    const inboundUser = await registerUser({
      email: inboundEmail,
      password: 'password123',
      username: `inbound_${uid}`,
    });
    // Inbound user sends request to caller
    await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${inboundUser.token}`)
      .send({ email: callerEmail });

    const res = await request(app)
      .get(`/api/social/search?q=inbound_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).not.toContain(inboundUser.userId);
  });

  it('excludes accepted friends', async () => {
    // Create an accepted friendship between caller and userAlpha
    const friendshipId = await createFriendship(callerToken, userAlpha.email, true, userAlpha.token);
    expect(friendshipId).toBeTruthy();

    const res = await request(app)
      .get(`/api/social/search?q=alpha_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).not.toContain(userAlpha.userId);
  });

  it('does NOT exclude users with declined friendship', async () => {
    // Register a user and create then decline a friendship
    const declinedEmail = `search-declined-${uid}@example.com`;
    const declinedUser = await registerUser({
      email: declinedEmail,
      password: 'password123',
      username: `declined_${uid}`,
    });
    // Caller sends request, declined user declines
    const fid = await createFriendship(callerToken, declinedEmail);
    await declineFriendship(fid, declinedUser.token);

    const res = await request(app)
      .get(`/api/social/search?q=declined_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).toContain(declinedUser.userId);
  });

  it('is case-insensitive', async () => {
    // userBeta has username beta_${uid} — search with uppercase
    const upperQ = `BETA_${uid}`.toUpperCase();
    const res = await request(app)
      .get(`/api/social/search?q=${encodeURIComponent(upperQ)}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const usernames = res.body.users.map((u: { username: string }) => u.username);
    expect(usernames).toContain(`beta_${uid}`);
  });

  it('returns results ordered by username ASC', async () => {
    // Search for the uid-suffixed pattern that matches multiple users
    const res = await request(app)
      .get(`/api/social/search?q=_${uid}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    const usernames = res.body.users.map((u: { username: string }) => u.username);
    const sorted = [...usernames].sort();
    expect(usernames).toEqual(sorted);
  });

  it('returns at most 10 results', async () => {
    // Register 12 extra users with a common prefix to exceed the limit
    const limitPrefix = `lim_${uid}`;
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        registerUser({
          email: `search-lim-${i}-${uid}@example.com`,
          password: 'password123',
          username: `${limitPrefix}_${i.toString().padStart(2, '0')}`,
        })
      )
    );

    const res = await request(app)
      .get(`/api/social/search?q=${encodeURIComponent(limitPrefix)}`)
      .set('Authorization', `Bearer ${callerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(10);
  });
});
