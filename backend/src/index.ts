import { config } from './config';
import { logger } from './lib/logger';
import app from './app';

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`, { port: config.port, env: config.nodeEnv });
});

process.on('unhandledRejection', (reason) => {
  logger.critical('Unhandled rejection', { error: String(reason) });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.critical('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
