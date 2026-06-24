import type { Express, RequestHandler } from 'express';
import helmet from 'helmet';
import cors, { type CorsOptions } from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Applies baseline hardening for a publicly-deployed API: proxy trust (so req.ip
// and HTTPS detection work behind Coolify's Traefik), security headers, and CORS.
// Body-size limits and per-route rate limiting are wired in app.ts.
export function applySecurity(app: Express): void {
  if (config.nodeEnv === 'production') {
    // One reverse-proxy hop (Traefik). Without this, req.ip is always the proxy
    // IP, breaking rate limiting and request logging, and req.protocol is wrong.
    // Keep this a number (hop count), never `true` — express-rate-limit rejects
    // a permissive `trust proxy: true` and would throw on the first request.
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      // The SPA is served same-origin by this server, but its inline module
      // bootstrap and asset loading don't fit helmet's default CSP. CSP tuning
      // is tracked separately; the rest of helmet's headers still apply.
      contentSecurityPolicy: false,
    }),
  );

  app.use(cors(corsOptions()));
}

function corsOptions(): CorsOptions {
  if (config.nodeEnv === 'production') {
    // The frontend is served same-origin, so cross-origin requests should only
    // come from an explicitly configured origin. Default closed (origin: false)
    // so a forgotten CORS_ORIGIN fails safe instead of reflecting any origin.
    return { origin: config.corsOrigin ?? false };
  }
  // Dev/test: permissive for local tooling and the Vite proxy.
  return {};
}

// Throttles unauthenticated auth traffic (login/register/refresh) to blunt
// credential brute-forcing and bcrypt CPU-exhaustion. Only active in production
// so it never causes flakiness in the integration/E2E suites.
export const authRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later.' },
  },
  skip: () => config.nodeEnv !== 'production',
});
