import { getRequestContext } from './requestContext';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',   // cyan
  info: '\x1b[32m',    // green
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  critical: '\x1b[35m', // magenta
};
const RESET = '\x1b[0m';

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function formatDev(level: LogLevel, message: string, extra: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const color = LEVEL_COLORS[level];
  const tag = `${color}[${level.toUpperCase()}]${RESET}`;

  const ctx = getRequestContext();
  let prefix = '';
  if (ctx) {
    prefix = ` [${ctx.requestId}] ${ctx.method} ${ctx.path}`;
    if (ctx.userId) {
      prefix += ` userId=${ctx.userId}`;
    }
  }

  const extraStr = Object.keys(extra).length > 0
    ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : '';

  return `${tag} ${timestamp}${prefix} — ${message}${extraStr}`;
}

function formatJson(level: LogLevel, message: string, extra: Record<string, unknown>): string {
  const ctx = getRequestContext();
  const obj: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
  };

  if (ctx) {
    obj.requestId = ctx.requestId;
    obj.method = ctx.method;
    obj.path = ctx.path;
    if (ctx.userId) {
      obj.userId = ctx.userId;
    }
  }

  obj.message = message;
  Object.assign(obj, extra);

  return JSON.stringify(obj);
}

function log(level: LogLevel, message: string, extra: Record<string, unknown> = {}): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[getMinLevel()]) {
    return;
  }

  const line = isProduction()
    ? formatJson(level, message, extra)
    : formatDev(level, message, extra);

  if (level === 'warn' || level === 'error' || level === 'critical') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) => log('debug', message, extra),
  info: (message: string, extra?: Record<string, unknown>) => log('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log('error', message, extra),
  critical: (message: string, extra?: Record<string, unknown>) => log('critical', message, extra),
};
