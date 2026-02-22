/**
 * Generate VAPID key pair for Web Push notifications.
 *
 * Usage: npx tsx src/scripts/generate-vapid-keys.ts
 *
 * Outputs base64url-encoded public and private keys to stdout.
 * Copy the values into start_local_env.sh and any production secrets manager.
 */

import { generateKeyPairSync } from 'crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

const publicKeyBase64url = publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64url');

const privateKeyBase64url = privateKey
  .export({ type: 'pkcs8', format: 'der' })
  .toString('base64url');

process.stdout.write('VAPID_PUBLIC_KEY=' + publicKeyBase64url + '\n');
process.stdout.write('VAPID_PRIVATE_KEY=' + privateKeyBase64url + '\n');
