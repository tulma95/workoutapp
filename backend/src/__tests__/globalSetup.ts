import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Run tests via ./run_test.sh to set up the test database.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('Database connectivity verified.');
  } catch (error) {
    throw new Error(
      `Cannot connect to test database at ${connectionString}. Is the test container running?\n${error}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
