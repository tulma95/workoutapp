import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../lib/db', () => ({
  default: {
    raw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

import app from '../app';

describe('GET /api/health', () => {
  it('returns 200 with status and database fields when DB is connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database', 'connected');
  });

  it('returns 503 when DB is disconnected', async () => {
    const db = await import('../lib/db');
    vi.mocked(db.default.raw).mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('status', 'error');
    expect(res.body).toHaveProperty('database', 'disconnected');
  });
});
