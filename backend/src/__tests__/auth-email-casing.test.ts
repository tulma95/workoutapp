import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import app from '../app';
import prisma from '../lib/db';

describe('Email casing normalization', () => {
  it('stores a registered email trimmed-lowercased', async () => {
    const id = randomUUID().slice(0, 8);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `MixedCase-${id}@Example.COM`, password: 'password123', username: `mc${id}` });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(`mixedcase-${id}@example.com`);
  });

  it('logs in regardless of the email case typed', async () => {
    const id = randomUUID().slice(0, 8);
    const email = `case-${id}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', username: `cs${id}` });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects a duplicate email that differs only in case', async () => {
    const id = randomUUID().slice(0, 8);
    const email = `dup-${id}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', username: `d1${id}` });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: 'password123', username: `d2${id}` });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('rejects registering an email that case-insensitively matches a legacy mixed-case row', async () => {
    const id = randomUUID().slice(0, 8);
    const mixed = `Legacy-${id}@Example.com`;
    // Seed a legacy mixed-case row directly, bypassing register's normalization.
    await prisma.user.create({ data: { email: mixed, passwordHash: 'x', username: `lg${id}` } });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: mixed.toLowerCase(), password: 'password123', username: `lg2${id}` });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('logs in against a legacy mixed-case row regardless of typed case', async () => {
    const id = randomUUID().slice(0, 8);
    const mixed = `Old-${id}@Example.com`;
    const hash = await bcrypt.hash('password123', 10);
    await prisma.user.create({ data: { email: mixed, passwordHash: hash, username: `old${id}` } });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: mixed.toLowerCase(), password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('lowercases an email changed via account settings', async () => {
    const id = randomUUID().slice(0, 8);
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: `ce-${id}@example.com`, password: 'password123', username: `ce${id}` });
    const token = reg.body.accessToken;

    const res = await request(app)
      .patch('/api/users/me/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newEmail: `New-${id}@Example.COM` });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(`new-${id}@example.com`);
  });
});
