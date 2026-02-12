import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Reset module cache to pick up env changes
    vi.resetModules();
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
  });

  async function getLogger() {
    const mod = await import('../../lib/logger');
    return mod.logger;
  }

  it('writes info to stdout in dev format', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';
    const logger = await getLogger();

    logger.info('Server started');

    expect(stdoutWrite).toHaveBeenCalledOnce();
    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('[INFO]');
    expect(output).toContain('Server started');
    expect(output).toContain('—');
  });

  it('writes error to stderr', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';
    const logger = await getLogger();

    logger.error('Something broke', { code: 'ERR_500' });

    expect(stderrWrite).toHaveBeenCalledOnce();
    const output = stderrWrite.mock.calls[0][0] as string;
    expect(output).toContain('[ERROR]');
    expect(output).toContain('Something broke');
    expect(output).toContain('code=');
  });

  it('writes warn to stderr', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';
    const logger = await getLogger();

    logger.warn('Auth failed');

    expect(stderrWrite).toHaveBeenCalledOnce();
    const output = stderrWrite.mock.calls[0][0] as string;
    expect(output).toContain('[WARN]');
  });

  it('writes critical to stderr', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';
    const logger = await getLogger();

    logger.critical('DB down');

    expect(stderrWrite).toHaveBeenCalledOnce();
    const output = stderrWrite.mock.calls[0][0] as string;
    expect(output).toContain('[CRITICAL]');
  });

  it('respects log level filtering', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'warn';
    const logger = await getLogger();

    logger.debug('should not appear');
    logger.info('should not appear');
    logger.warn('should appear');

    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledOnce();
  });

  it('outputs JSON in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'info';
    const logger = await getLogger();

    logger.info('User logged in', { userId: 5 });

    expect(stdoutWrite).toHaveBeenCalledOnce();
    const output = stdoutWrite.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('User logged in');
    expect(parsed.userId).toBe(5);
    expect(parsed.timestamp).toBeDefined();
  });

  it('includes extra fields in dev format', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'debug';
    const logger = await getLogger();

    logger.info('Test', { key: 'value', num: 42 });

    const output = stdoutWrite.mock.calls[0][0] as string;
    expect(output).toContain('key=');
    expect(output).toContain('num=');
  });
});
