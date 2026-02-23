import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/notifications.service', () => ({
  notificationManager: { notifyUser: vi.fn() },
}));

vi.mock('../../services/push.service', () => ({
  pushService: { sendToUser: vi.fn().mockResolvedValue(undefined) },
}));

import { notifyWithPush } from '../../lib/notificationHelpers';
import { notificationManager } from '../../services/notifications.service';
import { pushService } from '../../services/push.service';

describe('notifyWithPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls notificationManager.notifyUser with type and message', async () => {
    await notifyWithPush(123, { type: 'workout_completed', message: 'hello', url: '/test' });

    expect(notificationManager.notifyUser).toHaveBeenCalledOnce();
    expect(notificationManager.notifyUser).toHaveBeenCalledWith(123, {
      type: 'workout_completed',
      message: 'hello',
    });
  });

  it('calls pushService.sendToUser with the full serialised payload', async () => {
    await notifyWithPush(123, { type: 'workout_completed', message: 'hello', url: '/test' });

    expect(pushService.sendToUser).toHaveBeenCalledOnce();
    expect(pushService.sendToUser).toHaveBeenCalledWith(
      123,
      JSON.stringify({ type: 'workout_completed', message: 'hello', url: '/test' }),
    );
  });
});
