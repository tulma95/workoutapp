import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { config } from '../config';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

function signAccessToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

function stripPasswordHash(user: { id: number; email: string; displayName: string; unitPreference: string; createdAt: Date; updatedAt: Date; passwordHash?: string }) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function register(email: string, password: string, displayName: string, unitPreference: string = 'kg') {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, unitPreference },
  });

  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id),
    user: stripPasswordHash(user),
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id),
    user: stripPasswordHash(user),
  };
}
