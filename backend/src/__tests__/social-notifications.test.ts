import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
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

  it('does NOT call notifyUser when sending the request (sender is not notified)', async () => {
    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    notifyUserSpy.mockClear();

    // The request was already sent in beforeAll; check that no call was made to sender's id
    // (notifyUser was not called for sender/userIdA at that point)
    // We verify by sending a new request and checking which ids are notified
    const uidCheck = randomUUID().slice(0, 8);
    const resSender2 = await request(app).post('/api/auth/register').send({
      email: `notif-check-sender-${uidCheck}@example.com`,
      password: 'password123',
      username: `notif_check_sender_${uidCheck}`,
    });
    const sender2Token = resSender2.body.accessToken;
    const sender2Id = resSender2.body.user.id;

    const resRecipient2 = await request(app).post('/api/auth/register').send({
      email: `notif-check-recipient-${uidCheck}@example.com`,
      password: 'password123',
      username: `notif_check_recipient_${uidCheck}`,
    });
    const recipient2Id = resRecipient2.body.user.id;

    notifyUserSpy.mockClear();

    await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${sender2Token}`)
      .send({ email: `notif-check-recipient-${uidCheck}@example.com` });

    const calledIds = notifyUserSpy.mock.calls.map((args) => args[0]);
    expect(calledIds).toContain(recipient2Id);
    expect(calledIds).not.toContain(sender2Id);
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

describe('Friend request sent — notification', () => {
  afterEach(() => {
    vi.mocked(notificationManager.notifyUser).mockClear();
  });

  it('notifies the recipient when a new friend request is sent', async () => {
    const uidSent = randomUUID().slice(0, 8);
    const resSender = await request(app).post('/api/auth/register').send({
      email: `notif-sent-sender-${uidSent}@example.com`,
      password: 'password123',
      username: `notif_sent_sender_${uidSent}`,
    });
    const senderToken = resSender.body.accessToken;
    const senderUsername = `notif_sent_sender_${uidSent}`;

    const resRecipient = await request(app).post('/api/auth/register').send({
      email: `notif-sent-recipient-${uidSent}@example.com`,
      password: 'password123',
      username: `notif_sent_recipient_${uidSent}`,
    });
    const recipientId = resRecipient.body.user.id;

    vi.mocked(notificationManager.notifyUser).mockClear();

    const res = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-sent-recipient-${uidSent}@example.com` });

    expect(res.status).toBe(201);

    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    expect(notifyUserSpy).toHaveBeenCalledOnce();
    expect(notifyUserSpy).toHaveBeenCalledWith(recipientId, {
      type: 'friend_request_received',
      message: `${senderUsername} sent you a friend request`,
    });
  });

  it('notifies recipient again when re-requesting after a declined friendship', async () => {
    const uidRe = randomUUID().slice(0, 8);
    const resSender = await request(app).post('/api/auth/register').send({
      email: `notif-re-sender-${uidRe}@example.com`,
      password: 'password123',
      username: `notif_re_sender_${uidRe}`,
    });
    const senderToken = resSender.body.accessToken;
    const senderUsername = `notif_re_sender_${uidRe}`;

    const resRecipient = await request(app).post('/api/auth/register').send({
      email: `notif-re-recipient-${uidRe}@example.com`,
      password: 'password123',
      username: `notif_re_recipient_${uidRe}`,
    });
    const recipientToken = resRecipient.body.accessToken;
    const recipientId = resRecipient.body.user.id;

    // First request
    const reqRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-re-recipient-${uidRe}@example.com` });
    const friendshipId = reqRes.body.id;

    // Recipient declines
    await request(app)
      .patch(`/api/social/requests/${friendshipId}/decline`)
      .set('Authorization', `Bearer ${recipientToken}`);

    vi.mocked(notificationManager.notifyUser).mockClear();

    // Sender re-requests
    const reRes = await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-re-recipient-${uidRe}@example.com` });

    expect(reRes.status).toBe(201);

    const notifyUserSpy = vi.mocked(notificationManager.notifyUser);
    expect(notifyUserSpy).toHaveBeenCalledOnce();
    expect(notifyUserSpy).toHaveBeenCalledWith(recipientId, {
      type: 'friend_request_received',
      message: `${senderUsername} sent you a friend request`,
    });
  });

  it('does not notify the sender when sending a request', async () => {
    const uidNoSender = randomUUID().slice(0, 8);
    const resSender = await request(app).post('/api/auth/register').send({
      email: `notif-nosender-s-${uidNoSender}@example.com`,
      password: 'password123',
      username: `notif_nosender_s_${uidNoSender}`,
    });
    const senderToken = resSender.body.accessToken;
    const senderId = resSender.body.user.id;

    await request(app).post('/api/auth/register').send({
      email: `notif-nosender-r-${uidNoSender}@example.com`,
      password: 'password123',
      username: `notif_nosender_r_${uidNoSender}`,
    });

    vi.mocked(notificationManager.notifyUser).mockClear();

    await request(app)
      .post('/api/social/request')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ email: `notif-nosender-r-${uidNoSender}@example.com` });

    const calledIds = vi.mocked(notificationManager.notifyUser).mock.calls.map((args) => args[0]);
    expect(calledIds).not.toContain(senderId);
  });
});
