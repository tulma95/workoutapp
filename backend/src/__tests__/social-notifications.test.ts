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
import { notificationManager } from '../services/notifications.service';

const uid = randomUUID().slice(0, 8);

describe('Friend request accept — notification', () => {
  let tokenA: string;
  let userIdA: number;
  let tokenB: string;
  let friendshipId: number;

  beforeAll(async () => {
    // Register user A (initiator / sender)
    const resA = await request(app).post('/api/auth/register').send({
      email: `notif-req-a-${uid}@example.com`,
      password: 'password123',
      username: `notif_req_a_${uid}`,
    });
    tokenA = resA.body.accessToken;
    userIdA = resA.body.user.id;

    // Register user B (acceptor / recipient)
    const resB = await request(app).post('/api/auth/register').send({
      email: `notif-req-b-${uid}@example.com`,
      password: 'password123',
      username: `notif_req_b_${uid}`,
    });
    tokenB = resB.body.accessToken;

    // Register user C (unrelated third party — used to verify no stray notifications)
    await request(app).post('/api/auth/register').send({
      email: `notif-req-c-${uid}@example.com`,
      password: 'password123',
      username: `notif_req_c_${uid}`,
    });

    // A sends a friend request to B
    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: `notif-req-b-${uid}@example.com` });
    friendshipId = reqRes.body.id;
  });

  it('calls notifyUser with initiatorId and correct message when request is accepted', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    const res = await request(app)
      .patch(`/api/social/requests/${friendshipId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    expect(notifyUserSpy).toHaveBeenCalledOnce();
    expect(notifyUserSpy).toHaveBeenCalledWith(userIdA, {
      type: 'friend_request_accepted',
      message: `notif_req_b_${uid} accepted your friend request`,
    });
  });

  it('notifyUser is called only for the initiator, not the acceptor or others', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    const uidFresh = randomUUID().slice(0, 8);
    const resSender = await request(app).post('/api/auth/register').send({
      email: `notif-sender-${uidFresh}@example.com`,
      password: 'password123',
      username: `notif_sender_${uidFresh}`,
    });
    const senderToken = resSender.body.accessToken;
    const senderUserId = resSender.body.user.id;

    const resReceiver = await request(app).post('/api/auth/register').send({
      email: `notif-receiver-${uidFresh}@example.com`,
      password: 'password123',
      username: `notif_receiver_${uidFresh}`,
    });
    const receiverToken = resReceiver.body.accessToken;
    const receiverUserId = resReceiver.body.user.id;

    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-receiver-${uidFresh}@example.com` });
    const freshFriendshipId = reqRes.body.id;

    notifyUserSpy.mockClear();

    await request(app)
      .patch(`/api/social/requests/${freshFriendshipId}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`);

    // Only one notification call must have been made
    expect(notifyUserSpy).toHaveBeenCalledOnce();

    // The call must target the sender (initiator)
    expect(notifyUserSpy).toHaveBeenCalledWith(senderUserId, expect.any(Object));

    // The acceptor (receiver) must NOT be notified
    const allCalledUserIds = notifyUserSpy.mock.calls.map((args) => args[0]);
    expect(allCalledUserIds).not.toContain(receiverUserId);
  });

  it('does NOT call notifyUser when decline is issued instead', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    const uidDecline = randomUUID().slice(0, 8);
    const resSender = await request(app).post('/api/auth/register').send({
      email: `notif-dec-sender-${uidDecline}@example.com`,
      password: 'password123',
      username: `notif_dec_sender_${uidDecline}`,
    });
    const senderToken = resSender.body.accessToken;

    const resReceiver = await request(app).post('/api/auth/register').send({
      email: `notif-dec-receiver-${uidDecline}@example.com`,
      password: 'password123',
      username: `notif_dec_receiver_${uidDecline}`,
    });
    const receiverToken = resReceiver.body.accessToken;

    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-dec-receiver-${uidDecline}@example.com` });
    const declineFriendshipId = reqRes.body.id;

    notifyUserSpy.mockClear();

    const declineRes = await request(app)
      .patch(`/api/social/requests/${declineFriendshipId}/decline`)
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.status).toBe('declined');

    expect(notifyUserSpy).not.toHaveBeenCalled();
  });
});
