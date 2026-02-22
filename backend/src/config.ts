function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`[CRITICAL] Missing required environment variable: ${name}\n`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  jwtSecret: requireEnv('JWT_SECRET'),
  databaseUrl: requireEnv('DATABASE_URL'),
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'development' ? 'debug' : 'info'),
  vapidPublicKey: requireEnv('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: requireEnv('VAPID_PRIVATE_KEY'),
};
