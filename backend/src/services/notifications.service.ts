import { Response } from 'express';
import prisma from '../lib/db';

export interface NotificationPayload {
  type: 'workout_completed' | 'achievement_earned' | 'friend_request_accepted' | 'friend_request_received';
  message: string;
}

class NotificationManager {
  private connections = new Map<number, Response[]>();
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.heartbeatInterval = setInterval(() => {
      for (const [, responses] of this.connections) {
        for (const res of responses) {
          res.write(': heartbeat\n\n');
        }
      }
    }, 30_000);
    // Allow process to exit even if the interval is still active
    if (typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }
  }

  connect(userId: number, res: Response): void {
    const existing = this.connections.get(userId);
    if (existing) {
      existing.push(res);
    } else {
      this.connections.set(userId, [res]);
    }

    res.on('close', () => {
      const conns = this.connections.get(userId);
      if (!conns) return;
      const idx = conns.indexOf(res);
      if (idx !== -1) conns.splice(idx, 1);
      if (conns.length === 0) this.connections.delete(userId);
    });
  }

  notifyUser(userId: number, payload: NotificationPayload): void {
    const conns = this.connections.get(userId);
    if (!conns || conns.length === 0) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of conns) {
      res.write(data);
    }
  }

  async notifyFriends(fromUserId: number, payload: NotificationPayload): Promise<void> {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: fromUserId, status: 'accepted' },
          { addresseeId: fromUserId, status: 'accepted' },
        ],
      },
    });

    for (const f of friendships) {
      const friendId = f.requesterId === fromUserId ? f.addresseeId : f.requesterId;
      this.notifyUser(friendId, payload);
    }
  }
}

export const notificationManager = new NotificationManager();
