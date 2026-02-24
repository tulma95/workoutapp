import { apiFetch, apiFetchParsed } from './client';
import { pushPublicKeySchema, pushSubscribeResponseSchema } from './schemas';
export type { PushPublicKey, PushSubscribeResponse } from './schemas';

export async function getVapidPublicKey(): Promise<string> {
  const parsed = await apiFetchParsed('/notifications/public-key', pushPublicKeySchema);
  return parsed.publicKey;
}

export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<typeof pushSubscribeResponseSchema._output> {
  return apiFetchParsed('/notifications/subscribe', pushSubscribeResponseSchema, {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiFetch('/notifications/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
