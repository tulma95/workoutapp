import { notificationManager, NotificationPayload } from '../services/notifications.service';
import { pushService } from '../services/push.service';

export interface NotifyWithPushPayload extends NotificationPayload {
  url: string;
}

export async function notifyWithPush(
  userId: number,
  notification: NotifyWithPushPayload,
): Promise<void> {
  notificationManager.notifyUser(userId, { type: notification.type, message: notification.message });
  void pushService.sendToUser(userId, JSON.stringify(notification));
}
