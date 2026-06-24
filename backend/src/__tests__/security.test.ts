import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { config } from '../config';

describe('security middleware', () => {
  it('sets helmet hardening headers on responses', async () => {
    const res = await request(app).get('/api/health');

    // helmet defaults we rely on for a publicly-deployed API
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    // helmet removes the framework fingerprint
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects oversized JSON bodies with 413 instead of buffering them', async () => {
    const huge = 'a'.repeat(200 * 1024); // 200kb, over the 100kb limit
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: huge, password: huge }));

    expect(res.status).toBe(413);
  });

  it('throttles auth traffic with 429 once over the limit (production only)', async () => {
    // The limiter skips outside production, so flip env just for this assertion.
    const original = config.nodeEnv;
    config.nodeEnv = 'production';
    try {
      // Invalid body -> fast 400, but the limiter counts before the route runs.
      const limit = 30;
      let lastStatus = 0;
      for (let i = 0; i < limit + 1; i++) {
        const res = await request(app).post('/api/auth/login').send({});
        lastStatus = res.status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      config.nodeEnv = original;
    }
  });
});
