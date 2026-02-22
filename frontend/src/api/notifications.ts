import { apiFetch } from './client';
import { pushPublicKeySchema, pushSubscribeResponseSchema } from './schemas';
export type { PushPublicKey, PushSubscribeResponse } from './schemas';

export async function getVapidPublicKey(): Promise<string> {
  const data = await apiFetch('/notifications/public-key');
  const parsed = pushPublicKeySchema.parse(data);
  return parsed.publicKey;
}

export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<typeof pushSubscribeResponseSchema._output> {
  const data = await apiFetch('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
  return pushSubscribeResponseSchema.parse(data);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiFetch('/notifications/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
