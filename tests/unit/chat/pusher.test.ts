import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '@/lib/config/env';

// Mock pusher module before imports
vi.mock('pusher', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      trigger: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

// Mock getEnv so tests control Pusher config without depending on full env validation
const mockEnv: Partial<Env> = {};
vi.mock('@/lib/config/env', () => ({
  getEnv: () => mockEnv,
  resetEnvCache: vi.fn(),
}));

import { getPusher, triggerPusher, resetPusherCache } from '@/lib/chat/pusher';

function setPusherEnv(overrides: {
  appId?: string;
  key?: string;
  secret?: string;
  cluster?: string;
}) {
  mockEnv.PUSHER_APP_ID = overrides.appId;
  mockEnv.PUSHER_KEY = overrides.key;
  mockEnv.PUSHER_SECRET = overrides.secret;
  mockEnv.PUSHER_CLUSTER = overrides.cluster ?? 'mt1';
}

beforeEach(() => {
  resetPusherCache();
  // Clear pusher-related fields
  delete mockEnv.PUSHER_APP_ID;
  delete mockEnv.PUSHER_KEY;
  delete mockEnv.PUSHER_SECRET;
  delete mockEnv.PUSHER_CLUSTER;
  vi.clearAllMocks();
});

describe('getPusher', () => {
  it('returns null when PUSHER_APP_ID is missing', () => {
    setPusherEnv({ key: 'key', secret: 'secret' });
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when PUSHER_KEY is missing', () => {
    setPusherEnv({ appId: 'app-id', secret: 'secret' });
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when PUSHER_SECRET is missing', () => {
    setPusherEnv({ appId: 'app-id', key: 'key' });
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns null when all Pusher vars are missing', () => {
    const result = getPusher();
    expect(result).toBeNull();
  });

  it('returns a Pusher instance when all required env vars are set', () => {
    setPusherEnv({ appId: 'app-id', key: 'key', secret: 'secret', cluster: 'us2' });

    const result = getPusher();
    expect(result).not.toBeNull();
  });

  it('returns the same singleton instance on repeated calls', () => {
    setPusherEnv({ appId: 'app-id', key: 'key', secret: 'secret' });

    const first = getPusher();
    const second = getPusher();
    expect(first).toBe(second);
  });

  it('creates a fresh instance after resetPusherCache', () => {
    setPusherEnv({ appId: 'app-id', key: 'key', secret: 'secret' });

    const first = getPusher();
    resetPusherCache();
    const second = getPusher();
    expect(first).not.toBe(second);
  });
});

describe('triggerPusher', () => {
  it('does nothing (no error) when Pusher is not configured', async () => {
    // No Pusher vars set — getPusher returns null
    await expect(
      triggerPusher('channel', 'event', { foo: 'bar' })
    ).resolves.toBeUndefined();
  });

  it('calls pusher.trigger when configured', async () => {
    setPusherEnv({ appId: 'app-id', key: 'key', secret: 'secret' });

    const pusher = getPusher();
    await triggerPusher('my-channel', 'my-event', { hello: 'world' });

    expect(pusher?.trigger).toHaveBeenCalledWith(
      'my-channel',
      'my-event',
      { hello: 'world' }
    );
  });
});
