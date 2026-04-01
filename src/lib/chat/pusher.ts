import Pusher from 'pusher';

let _pusher: Pusher | null = null;

export function getPusher(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? 'mt1';

  if (!appId || !key || !secret) return null;

  if (!_pusher) {
    _pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
  }
  return _pusher;
}

export async function triggerPusher(
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return; // graceful degradation if Pusher not configured
  await pusher.trigger(channel, event, data);
}

/** Reset cached Pusher instance (for tests). */
export function resetPusherCache(): void {
  _pusher = null;
}
