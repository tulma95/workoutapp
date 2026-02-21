import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { config } from '../config';
import { logger } from '../lib/logger';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

function signAccessToken(userId: number, email: string, isAdmin: boolean): string {
  return jwt.sign({ userId, email, isAdmin }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

function stripPasswordHash(user: { id: number; email: string; username: string; isAdmin: boolean; createdAt: Date; updatedAt: Date; passwordHash?: string }) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export async function register(email: string, password: string, username: string) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, username },
  });

  logger.info('User registered', { email: user.email, userId: user.id });

  return {
    accessToken: signAccessToken(user.id, user.email, user.isAdmin),
    refreshToken: signRefreshToken(user.id),
    user: stripPasswordHash(user),
  };
}

export async function refreshTokens(refreshToken: string) {
  let decoded: { userId: number; type?: string };
  try {
    decoded = jwt.verify(refreshToken, config.jwtSecret) as typeof decoded;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    throw new Error('Invalid or expired refresh token');
  }

  return {
    accessToken: signAccessToken(user.id, user.email, user.isAdmin),
    refreshToken: signRefreshToken(user.id),
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.warn('Login failed: unknown email', { email });
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    logger.warn('Login failed: invalid password', { email });
    throw new Error('Invalid email or password');
  }

  logger.info('User logged in', { email, userId: user.id });

  return {
    accessToken: signAccessToken(user.id, user.email, user.isAdmin),
    refreshToken: signRefreshToken(user.id),
    user: stripPasswordHash(user),
  };
}
