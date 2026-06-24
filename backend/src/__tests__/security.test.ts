import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

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
});
