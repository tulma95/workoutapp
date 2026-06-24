import { logger } from './logger';

type Closable = { close: (cb: (err?: Error) => void) => void };
type Disconnect = () => Promise<unknown>;
type Exit = (code: number) => void;

// Orchestrates a graceful shutdown: stop accepting new connections, let
// in-flight requests drain, disconnect the database, then exit. Coolify/Traefik
// send SIGTERM on every redeploy, so without this the HTTP server is killed
// mid-request and DB connections leak.
//
// Dependencies are injected so this can be unit-tested without real signals,
// a real server, or mocking the Prisma module.
export function gracefulShutdown(
  server: Closable,
  disconnect: Disconnect,
  exit: Exit,
  timeoutMs = 10000,
): void {
  let exited = false;
  const finish = (code: number) => {
    if (exited) return;
    exited = true;
    exit(code);
  };

  server.close(async (err?: Error) => {
    if (err) {
      logger.error('Error closing HTTP server during shutdown', { error: err.message });
    }
    try {
      await disconnect();
    } catch (e) {
      logger.error('Error disconnecting database during shutdown', { error: String(e) });
    }
    finish(err ? 1 : 0);
  });

  // Don't hang forever if connections refuse to drain.
  const timer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    finish(1);
  }, timeoutMs);
  // Don't let the timer itself keep the process alive.
  if (typeof timer.unref === 'function') timer.unref();
}
