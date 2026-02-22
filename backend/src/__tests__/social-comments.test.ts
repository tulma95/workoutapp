import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

vi.mock('../services/notifications.service', () => ({
  notificationManager: {
    notifyUser: vi.fn(),
    notifyFriends: vi.fn(),
    connect: vi.fn(),
  },
}));

import app from '../app';
import prisma from '../lib/db';
import { notificationManager } from '../services/notifications.service';

const uid = randomUUID().slice(0, 8);

describe('Feed event comments', () => {
  let tokenA: string;
  let userIdA: number;

  let tokenB: string;
  let userIdB: number;
  let usernameB: string;

  let tokenC: string;

  let eventId: number;

  beforeAll(async () => {
    // Register userA — event owner
    const resA = await request(app).post('/api/auth/register').send({
      email: `comment-a-${uid}@example.com`,
      password: 'password123',
      username: `comment_a_${uid}`,
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // Register userB — friend / commenter
    const resB = await request(app).post('/api/auth/register').send({
      email: `comment-b-${uid}@example.com`,
      password: 'password123',
      username: `comment_b_${uid}`,
    });
    tokenB = resB.body.accessToken;
    userIdB = resB.body.user.id;
    usernameB = `comment_b_${uid}`;

    // Register userC — non-friend / third party
    const resC = await request(app).post('/api/auth/register').send({
      email: `comment-c-${uid}@example.com`,
      password: 'password123',
      username: `comment_c_${uid}`,
    });
    tokenC = resC.body.accessToken;

    // A sends friend request to B
    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: `comment-b-${uid}@example.com` });
    const friendshipId = reqRes.body.id;

    // B accepts
    await request(app)
      .patch(`/api/social/requests/${friendshipId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    // Create a feed event owned by userA
    const feedEvent = await prisma.feedEvent.create({
      data: {
        userId: userIdA,
        eventType: 'workout_completed',
        payload: { workoutId: 1, dayNumber: 1 },
      },
    });
    eventId = feedEvent.id;
  });

  // Auth guard tests
  it('POST /feed/:eventId/comments requires auth (401)', async () => {
    const res = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .send({ text: 'hello' });
    expect(res.status).toBe(401);
  });

  it('GET /feed/:eventId/comments requires auth (401)', async () => {
    const res = await request(app).get(`/api/social/feed/${eventId}/comments`);
    expect(res.status).toBe(401);
  });

  it('DELETE /feed/:eventId/comments/1 requires auth (401)', async () => {
    const res = await request(app).delete(`/api/social/feed/${eventId}/comments/1`);
    expect(res.status).toBe(401);
  });

  // 404 when event not found
  it('POST returns 404 when event does not exist', async () => {
    const res = await request(app)
      .post('/api/social/feed/999999999/comments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'hello' });
    expect(res.status).toBe(404);
  });

  // 403 non-friend cannot comment
  it('POST returns 403 when commenter is not a friend of the event owner', async () => {
    const res = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ text: 'hello from non-friend' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Validation: empty text
  it('POST returns 400 when text is empty', async () => {
    const res = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });

  // Validation: text too long
  it('POST returns 400 when text exceeds 500 chars', async () => {
    const longText = 'a'.repeat(501);
    const res = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: longText });
    expect(res.status).toBe(400);
  });

  // Successful create
  it('POST returns 201 with correct shape on success', async () => {
    const res = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Great workout!' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      feedEventId: eventId,
      userId: userIdB,
      text: 'Great workout!',
      createdAt: expect.any(String),
    });
  });

  // GET returns comments ordered by createdAt ASC
  it('GET returns comments ordered by createdAt ASC', async () => {
    // Create a fresh event to isolate ordering test
    const freshEvent = await prisma.feedEvent.create({
      data: {
        userId: userIdA,
        eventType: 'workout_completed',
        payload: { workoutId: 2, dayNumber: 2 },
      },
    });

    await request(app)
      .post(`/api/social/feed/${freshEvent.id}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'First comment' });

    await request(app)
      .post(`/api/social/feed/${freshEvent.id}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Second comment' });

    const res = await request(app)
      .get(`/api/social/feed/${freshEvent.id}/comments`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(2);
    expect(res.body.comments[0].text).toBe('First comment');
    expect(res.body.comments[1].text).toBe('Second comment');
    // Verify shape includes username
    expect(res.body.comments[0]).toMatchObject({
      id: expect.any(Number),
      feedEventId: freshEvent.id,
      userId: userIdB,
      username: usernameB,
      text: 'First comment',
      createdAt: expect.any(String),
    });
  });

  // DELETE own comment succeeds
  it('DELETE own comment returns 200', async () => {
    // Create a comment as userB
    const createRes = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Comment to self-delete' });
    const commentId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/social/feed/${eventId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: commentId });
  });

  // DELETE as event owner succeeds
  it('DELETE as event owner (userA) deletes userB comment', async () => {
    const createRes = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Comment to be deleted by owner' });
    const commentId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/social/feed/${eventId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: commentId });
  });

  // DELETE by third party returns 403
  it('DELETE returns 403 when caller is not author or event owner', async () => {
    const createRes = await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Comment that third party tries to delete' });
    const commentId = createRes.body.id;

    const res = await request(app)
      .delete(`/api/social/feed/${eventId}/comments/${commentId}`)
      .set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Notification: comment by friend notifies event owner
  it('notifies event owner when friend comments, not the commenter', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    await request(app)
      .post(`/api/social/feed/${eventId}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ text: 'Triggering notification' });

    const calledIds = notifyUserSpy.mock.calls.map((args) => args[0]);
    expect(calledIds).toContain(userIdA);
    expect(calledIds).not.toContain(userIdB);

    expect(notifyUserSpy).toHaveBeenCalledWith(userIdA, {
      type: 'comment_received',
      message: `${usernameB} commented on your activity`,
    });
  });

  // No notification when event owner comments on own event
  it('does NOT notify event owner when they comment on their own event', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    // Create a fresh event owned by userA so userB is the friend
    const ownEvent = await prisma.feedEvent.create({
      data: {
        userId: userIdA,
        eventType: 'workout_completed',
        payload: { workoutId: 3, dayNumber: 1 },
      },
    });

    // userA comments on their own event
    await request(app)
      .post(`/api/social/feed/${ownEvent.id}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'Self comment' });

    // userA is a friend of userB but the endpoint checks userId !== event.userId
    // Since userA owns the event and is the commenter, no notification should fire for userA
    const calledIds = notifyUserSpy.mock.calls.map((args) => args[0]);
    expect(calledIds).not.toContain(userIdA);
  });
});
