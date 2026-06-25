import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Bound the connection pool so we don't exhaust a shared Postgres (Coolify's
// managed instance), or — under vitest's parallel, per-file-isolated test runs —
// the test database's connection limit (each isolated file opens its own pool).
// Configurable via DATABASE_POOL_MAX; pg's default applies when unset.
const parsedPoolMax = Math.floor(Number(process.env.DATABASE_POOL_MAX));
const poolMax = Number.isFinite(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : undefined;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ...(poolMax !== undefined ? { max: poolMax } : {}),
});
const prisma = new PrismaClient({ adapter });

export default prisma;
