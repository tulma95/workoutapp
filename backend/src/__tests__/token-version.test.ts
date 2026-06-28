/**
 * Integration tests for tokenVersion-based session invalidation (ticket 170).
 *
 * Verifies:
 *   (a) after password change, old access and refresh tokens are rejected with 401
 *   (b) tokens issued AFTER a password change still work
 *   (c) normal login/auth flow continues to work
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';

function uid() {
  return randomUUID().slice(0, 8);
}

async function registerUser(suffix: string) {
  const email = `tv-${suffix}@example.com`;
  const password = 'password123';
  const username = `tv_${suffix}`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, username });
  expect(res.status).toBe(201);
  return {
    email,
    password,
    username,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

describe('tokenVersion — password change invalidates old tokens', () => {
  it('(a) old access token is rejected with 401 after password change', async () => {
    const u = await registerUser(uid());
    const oldAccessToken = u.accessToken;

    // Confirm old token works before the change
    const before = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    expect(before.status).toBe(200);

    // Change the password — returns new tokens
    const changeRes = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .send({ currentPassword: u.password, newPassword: 'newpassword456' });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body).toHaveProperty('accessToken');
    expect(changeRes.body).toHaveProperty('refreshToken');

    // Old access token must now be rejected
    const after = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('TOKEN_INVALID');
  });

  it('(a) old refresh token is rejected with 401 after password change', async () => {
    const u = await registerUser(uid());
    const oldRefreshToken = u.refreshToken;

    // Confirm old refresh token works before the change
    const before = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });
    expect(before.status).toBe(200);

    // Change the password with the current access token
    const changeRes = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ currentPassword: u.password, newPassword: 'newpassword456' });
    expect(changeRes.status).toBe(200);

    // Old refresh token must now be rejected
    const after = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('TOKEN_INVALID');
  });

  it('(b) new access token returned from password change still works', async () => {
    const u = await registerUser(uid());

    const changeRes = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ currentPassword: u.password, newPassword: 'newpassword456' });
    expect(changeRes.status).toBe(200);

    const newAccessToken = changeRes.body.accessToken as string;

    // New access token must be accepted
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toHaveProperty('email', u.email);
  });

  it('(b) new refresh token returned from password change issues valid tokens', async () => {
    const u = await registerUser(uid());

    const changeRes = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ currentPassword: u.password, newPassword: 'newpassword456' });
    expect(changeRes.status).toBe(200);

    const newRefreshToken = changeRes.body.refreshToken as string;

    // New refresh token must issue a valid access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: newRefreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');

    // The re-issued access token must work
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('(b) login after password change issues working tokens', async () => {
    const u = await registerUser(uid());
    const newPassword = 'newpassword456';

    const changeRes = await request(app)
      .patch('/api/users/me/password')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ currentPassword: u.password, newPassword });
    expect(changeRes.status).toBe(200);

    // Login with new password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: newPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');

    // Token from fresh login must work
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
  });

  it('(c) normal registration + auth flow works', async () => {
    const u = await registerUser(uid());

    // Access token from register works
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${u.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toHaveProperty('email', u.email);
    expect(meRes.body).not.toHaveProperty('passwordHash');
    expect(meRes.body).not.toHaveProperty('tokenVersion');

    // Refresh token issues new valid tokens
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: u.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('refreshToken');
  });

  it('(c) normal login flow works', async () => {
    const u = await registerUser(uid());

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');
    expect(loginRes.body.user).not.toHaveProperty('tokenVersion');

    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
  });
});
