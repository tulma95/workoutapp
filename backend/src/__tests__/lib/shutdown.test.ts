import { describe, it, expect, vi } from 'vitest';
import { gracefulShutdown } from '../../lib/shutdown';

// A fake http.Server whose close() invokes its callback with the given error.
function fakeServer(closeErr?: Error) {
  return {
    close: vi.fn((cb: (err?: Error) => void) => cb(closeErr)),
  };
}

describe('gracefulShutdown', () => {
  it('closes the server, disconnects, then exits 0 on a clean shutdown', async () => {
    const server = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    gracefulShutdown(server, disconnect, exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(server.close).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('still disconnects and exits 1 when the server fails to close', async () => {
    const server = fakeServer(new Error('close failed'));
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    gracefulShutdown(server, disconnect, exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(disconnect).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits even if disconnect rejects (no hang)', async () => {
    const server = fakeServer();
    const disconnect = vi.fn().mockRejectedValue(new Error('db gone'));
    const exit = vi.fn();

    gracefulShutdown(server, disconnect, exit);
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(0);
  });

  it('only exits once even if close and the timeout both fire', async () => {
    vi.useFakeTimers();
    // close callback never fires -> timeout path drives the exit.
    const server = { close: vi.fn() };
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    gracefulShutdown(server, disconnect, exit, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
