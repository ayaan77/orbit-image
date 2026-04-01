import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pusher module before imports
vi.mock('pusher', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      trigger: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { getPusher, triggerPusher, resetPusherCache } from '@/lib/chat/pusher';

beforeEach(() => {
  resetPusherCache();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('getPusher', () => {
  it('returns null when PUSHER_APP_ID is missing', () => {
    vi.stubEnv('PUSHER_KEY', 'key');
    vi.stubEnv('PUSHER_SECRET', 'secret');
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when PUSHER_KEY is missing', () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_SECRET', 'secret');
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when PUSHER_SECRET is missing', () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_KEY', 'key');
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when all Pusher vars are missing', () => {
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns a Pusher instance when all required env vars are set', () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_KEY', 'key');
    vi.stubEnv('PUSHER_SECRET', 'secret');
    vi.stubEnv('PUSHER_CLUSTER', 'us2');

    const result = getPusher();
    expect(result).not.toBeNull();
  });

  it('returns the same singleton instance on repeated calls', () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_KEY', 'key');
    vi.stubEnv('PUSHER_SECRET', 'secret');

    const first = getPusher();
    const second = getPusher();
    expect(first).toBe(second);
  });

  it('creates a fresh instance after resetPusherCache', () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_KEY', 'key');
    vi.stubEnv('PUSHER_SECRET', 'secret');

    const first = getPusher();
    resetPusherCache();
    const second = getPusher();
    expect(first).not.toBe(second);
  });
});

describe('triggerPusher', () => {
  it('does nothing (no error) when Pusher is not configured', async () => {
    // No env vars set — getPusher returns null
    await expect(
      triggerPusher('channel', 'event', { foo: 'bar' })
    ).resolves.toBeUndefined();
  });

  it('calls pusher.trigger when configured', async () => {
    vi.stubEnv('PUSHER_APP_ID', 'app-id');
    vi.stubEnv('PUSHER_KEY', 'key');
    vi.stubEnv('PUSHER_SECRET', 'secret');

    const pusher = getPusher();
    await triggerPusher('my-channel', 'my-event', { hello: 'world' });

    expect(pusher?.trigger).toHaveBeenCalledWith(
      'my-channel',
      'my-event',
      { hello: 'world' }
    );
  });
});
