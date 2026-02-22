import prisma from '../lib/db';
import { logger } from '../lib/logger';
import { sendWebPush, ExpiredSubscriptionError } from '../lib/webpush';
import { config } from '../config';

class PushNotificationService {
  async subscribe(
    userId: number,
    { endpoint, p256dh, auth }: { endpoint: string; p256dh: string; auth: string },
  ): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh, auth },
      create: { userId, endpoint, p256dh, auth },
    });
  }

  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async sendToUser(userId: number, payload: string): Promise<void> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey },
          );
        } catch (err) {
          if (err instanceof ExpiredSubscriptionError) {
            await prisma.pushSubscription.deleteMany({
              where: { userId, endpoint: sub.endpoint },
            });
          } else {
            logger.error('Push notification failed', {
              err: String(err),
              userId,
              endpoint: sub.endpoint,
            });
          }
        }
      }),
    );
  }
}

export const pushService = new PushNotificationService();
