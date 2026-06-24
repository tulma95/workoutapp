import { config } from './config';
import { logger } from './lib/logger';
import prisma from './lib/db';
import { register } from './services/auth.service';
import { gracefulShutdown } from './lib/shutdown';
import app from './app';

const DEV_ADMIN_EMAIL = 'admin@dev.local';
const DEV_ADMIN_PASSWORD = 'admin123';

async function seedDevAdmin() {
  if (config.nodeEnv !== 'development') return;

  const existing = await prisma.user.findUnique({ where: { email: DEV_ADMIN_EMAIL } });
  if (existing) return;

  const { user } = await register(DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, 'Admin');
  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  });
  logger.info(`Dev admin user created: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
}

seedDevAdmin().catch((err) => {
  logger.warn('Failed to seed dev admin user', { error: String(err) });
});

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`, { port: config.port, env: config.nodeEnv });
});

// Drain in-flight requests and close DB connections on redeploy/stop signals.
// `once` so a second signal falls through to Node's default (immediate exit)
// instead of re-entering shutdown and calling server.close() twice.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info(`Received ${signal}, shutting down gracefully`, { signal });
    gracefulShutdown(server, () => prisma.$disconnect(), (code) => process.exit(code));
  });
}

process.on('unhandledRejection', (reason) => {
  logger.critical('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.critical('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
