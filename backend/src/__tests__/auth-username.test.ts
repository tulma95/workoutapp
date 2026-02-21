import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../app';

const uid = randomUUID().slice(0, 8);

function email(tag: string) {
  return `auth-username-${tag}-${uid}@example.com`;
}

function username(tag: string) {
  return `user_${tag}_${uid}`;
}

describe('Username support in auth and users routes', () => {
  describe('POST /api/auth/register', () => {
    it('registers without username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: email('no-uname'),
        password: 'password123',
        displayName: 'No Username',
      });
      expect(res.status).toBe(201);
      expect(res.body.user.username).toBeNull();
    });

    it('registers with a valid username', async () => {
      const uname = username('valid');
      const res = await request(app).post('/api/auth/register').send({
        email: email('with-uname'),
        password: 'password123',
        displayName: 'With Username',
        username: uname,
      });
      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe(uname);
    });

    it('returns 422 for username with invalid chars', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: email('invalid-chars'),
        password: 'password123',
        displayName: 'Bad Username',
        username: 'bad-username!',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for username too short', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: email('too-short'),
        password: 'password123',
        displayName: 'Short Username',
        username: 'ab',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for username too long', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: email('too-long'),
        password: 'password123',
        displayName: 'Long Username',
        username: 'a'.repeat(31),
      });
      expect(res.status).toBe(422);
    });

    it('returns 409 USERNAME_EXISTS for duplicate username', async () => {
      const uname = username('dup');
      // First registration
      await request(app).post('/api/auth/register').send({
        email: email('dup1'),
        password: 'password123',
        displayName: 'Dup User 1',
        username: uname,
      });
      // Second registration with same username
      const res = await request(app).post('/api/auth/register').send({
        email: email('dup2'),
        password: 'password123',
        displayName: 'Dup User 2',
        username: uname,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_EXISTS');
    });

    it('returns 409 EMAIL_EXISTS for duplicate email (not USERNAME_EXISTS)', async () => {
      const sharedEmail = email('dup-email');
      await request(app).post('/api/auth/register').send({
        email: sharedEmail,
        password: 'password123',
        displayName: 'Email Dup 1',
      });
      const res = await request(app).post('/api/auth/register').send({
        email: sharedEmail,
        password: 'password123',
        displayName: 'Email Dup 2',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('PATCH /api/users/me', () => {
    let token: string;

    async function registerUser(tag: string, uname?: string) {
      const res = await request(app).post('/api/auth/register').send({
        email: email(tag),
        password: 'password123',
        displayName: `Patch User ${tag}`,
        ...(uname !== undefined ? { username: uname } : {}),
      });
      return res.body.accessToken as string;
    }

    it('can set username via PATCH', async () => {
      token = await registerUser('patch-set');
      const uname = username('patch-set');
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: uname });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(uname);
    });

    it('returns 409 USERNAME_EXISTS on duplicate username via PATCH', async () => {
      const uname = username('patch-dup');
      // Register user A with the username
      await registerUser('patch-dup-a', uname);
      // Register user B without username, then try to claim same username
      const tokenB = await registerUser('patch-dup-b');
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ username: uname });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_EXISTS');
    });

    it('returns 422 for invalid username via PATCH', async () => {
      const t = await registerUser('patch-invalid');
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${t}`)
        .send({ username: 'has spaces' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns username field', async () => {
      const uname = username('get-me');
      const regRes = await request(app).post('/api/auth/register').send({
        email: email('get-me'),
        password: 'password123',
        displayName: 'Get Me User',
        username: uname,
      });
      const token = regRes.body.accessToken;

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(uname);
    });

    it('returns null username for user registered without one', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        email: email('get-me-null'),
        password: 'password123',
        displayName: 'No Username User',
      });
      const token = regRes.body.accessToken;

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBeNull();
    });
  });
});
