/**
 * Web Push notification implementation per RFC 8030, RFC 8188, and RFC 8292.
 * Uses only Node.js built-in crypto — no npm dependencies.
 */

import {
  createPublicKey,
  createPrivateKey,
  createECDH,
  hkdfSync,
  createCipheriv,
  sign,
  randomBytes,
} from 'crypto';

export class ExpiredSubscriptionError extends Error {
  constructor() {
    super('Push subscription expired (410 Gone)');
    this.name = 'ExpiredSubscriptionError';
  }
}

/**
 * Build the VAPID JWT and extract the raw EC public key point.
 * VAPID keys are stored as SPKI (public) and PKCS8 (private) DER bytes, base64url-encoded.
 */
function buildVapidJwt(
  endpoint: string,
  vapidKeys: { publicKey: string; privateKey: string },
): { jwt: string; vapidPublicKeyRaw: Buffer } {
  const privateKeyObj = createPrivateKey({
    key: Buffer.from(vapidKeys.privateKey, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  });

  const publicKeyObj = createPublicKey({
    key: Buffer.from(vapidKeys.publicKey, 'base64url'),
    format: 'der',
    type: 'spki',
  });

  // Extract uncompressed EC point (04 || x || y) from JWK
  const jwk = publicKeyObj.export({ format: 'jwk' }) as { x: string; y: string };
  const vapidPublicKeyRaw = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]);

  // Audience is the origin of the push endpoint
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const jwtHeader = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const jwtPayload = Buffer.from(
    JSON.stringify({ aud: audience, exp, sub: 'mailto:admin@setforge.app' }),
  ).toString('base64url');

  const signingInput = Buffer.from(`${jwtHeader}.${jwtPayload}`);
  // ES256 signature using ieee-p1363 encoding (r || s, no DER wrapper)
  const signature = sign('SHA-256', signingInput, {
    key: privateKeyObj,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${jwtHeader}.${jwtPayload}.${signature.toString('base64url')}`;

  return { jwt, vapidPublicKeyRaw };
}

/**
 * Encrypt a payload per RFC 8291 (Web Push Message Encryption) + RFC 8188 (aes128gcm).
 * Returns the encrypted body ready to POST to the push endpoint.
 */
function encryptPayload(
  subscription: { p256dh: string; auth: string },
  payload: string,
): Buffer {
  const subscriberPublicKey = Buffer.from(subscription.p256dh, 'base64url');
  const authSecret = Buffer.from(subscription.auth, 'base64url');

  // Random 16-byte salt (unique per message)
  const salt = randomBytes(16);

  // Ephemeral P-256 sender key pair for this message
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const senderPublicKey = ecdh.getPublicKey(); // 65-byte uncompressed point

  // ECDH shared secret
  const sharedSecret = ecdh.computeSecret(subscriberPublicKey);

  // RFC 8291 Section 3.3: derive IKM
  // info = "WebPush: info\0" || subscriberPublicKey (65 bytes) || senderPublicKey (65 bytes)
  const webPushInfo = Buffer.concat([
    Buffer.from('WebPush: info\x00'),
    subscriberPublicKey,
    senderPublicKey,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, webPushInfo, 32));

  // RFC 8188 Section 2.1: derive content encryption key and nonce
  const cek = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\x00'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\x00'), 12),
  );

  // Encrypt: plaintext + 0x02 end-of-record delimiter (RFC 8188 single-record)
  const plaintext = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([0x02])]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  // RFC 8188 aes128gcm header: salt (16) + rs (uint32 BE) + idlen (uint8) + key_id
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([senderPublicKey.length]), senderPublicKey]);

  return Buffer.concat([header, ciphertext]);
}

/**
 * Send a Web Push notification to a single subscription.
 *
 * @throws {ExpiredSubscriptionError} when the push service returns 410 Gone
 * @throws {Error} on any other non-2xx response
 */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKey: string },
): Promise<void> {
  const { jwt, vapidPublicKeyRaw } = buildVapidJwt(subscription.endpoint, vapidKeys);
  const encryptedBody = encryptPayload(subscription, payload);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKeyRaw.toString('base64url')}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: new Uint8Array(encryptedBody),
  });

  if (response.status === 410) {
    throw new ExpiredSubscriptionError();
  }

  if (!response.ok) {
    throw new Error(`Web Push request failed: ${response.status} ${response.statusText}`);
  }
}
