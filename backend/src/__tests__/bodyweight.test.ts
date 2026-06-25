import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { createTestUser } from './helpers';

describe('Bodyweight API', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/bodyweight')).status).toBe(401);
    expect((await request(app).post('/api/bodyweight').send({ weight: 80 })).status).toBe(401);
  });

  it('logs entries and returns them ordered oldest-first', async () => {
    const { token } = await createTestUser();

    const first = await request(app)
      .post('/api/bodyweight')
      .set('Authorization', `Bearer ${token}`)
      .send({ weight: 82.5 });
    expect(first.status).toBe(201);
    expect(first.body.weight).toBe(82.5);
    expect(typeof first.body.id).toBe('number');
    expect(typeof first.body.recordedAt).toBe('string');

    await request(app)
      .post('/api/bodyweight')
      .set('Authorization', `Bearer ${token}`)
      .send({ weight: 81.2 });

    const history = await request(app)
      .get('/api/bodyweight')
      .set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(history.body.entries).toHaveLength(2);
    expect(history.body.entries[0].weight).toBe(82.5);
    expect(history.body.entries[1].weight).toBe(81.2);
  });

  it('rejects invalid weights', async () => {
    const { token } = await createTestUser();
    for (const weight of [0, -5, 1000]) {
      const res = await request(app)
        .post('/api/bodyweight')
        .set('Authorization', `Bearer ${token}`)
        .send({ weight });
      expect(res.status).toBe(400);
    }
  });

  it('deletes own entry but not another user\'s', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();

    const created = await request(app)
      .post('/api/bodyweight')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ weight: 90 });
    const entryId = created.body.id;

    // Other user cannot delete it.
    const forbidden = await request(app)
      .delete(`/api/bodyweight/${entryId}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(forbidden.status).toBe(404);

    // Owner can.
    const deleted = await request(app)
      .delete(`/api/bodyweight/${entryId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);

    const history = await request(app)
      .get('/api/bodyweight')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(history.body.entries).toHaveLength(0);
  });
});
