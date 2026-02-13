import { randomUUID } from 'crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import prisma from '../lib/db';

export function uniqueId(): string {
  return randomUUID().slice(0, 8);
}

export async function createTestUser(opts: {
  email?: string;
  password?: string;
  displayName?: string;
  unitPreference?: 'kg' | 'lb';
  isAdmin?: boolean;
} = {}) {
  const password = opts.password ?? 'password123';
  const user = await prisma.user.create({
    data: {
      email: opts.email ?? `user-${uniqueId()}@example.com`,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: opts.displayName ?? 'Test User',
      unitPreference: opts.unitPreference ?? 'kg',
      isAdmin: opts.isAdmin ?? false,
    },
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password });

  return { user, token: loginRes.body.accessToken as string };
}

export async function getExercisesBySlug(slugs: string[]) {
  const exercises = await prisma.exercise.findMany({
    where: { slug: { in: slugs } },
  });
  return Object.fromEntries(exercises.map(e => [e.slug, e]));
}
