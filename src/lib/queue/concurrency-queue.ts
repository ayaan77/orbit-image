import { QueueTimeoutError } from "./errors";

export interface QueueStats {
  readonly active: number;
  readonly queued: number;
  readonly maxConcurrent: number;
}

interface QueuedItem {
  readonly resolve: () => void;
  readonly reject: (err: Error) => void;
}

export class ConcurrencyQueue {
  private active = 0;
  private readonly waiting: QueuedItem[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly timeoutMs: number,
  ) {}

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.maxConcurrent) {
      return this.execute(fn);
    }

    // Wait for a slot
    await this.waitForSlot();
    return this.execute(fn);
  }

  getStats(): QueueStats {
    return {
      active: this.active,
      queued: this.waiting.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  drain(): void {
    const items = this.waiting.splice(0);
    for (const item of items) {
      item.reject(new Error("Queue drained"));
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const item: QueuedItem = {
        resolve: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        reject: (err: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        },
      };

      const timer = setTimeout(() => {
        if (settled) return;
        const idx = this.waiting.indexOf(item);
        if (idx !== -1) {
          this.waiting.splice(idx, 1);
        }
        item.reject(new QueueTimeoutError(this.timeoutMs));
      }, this.timeoutMs);

      this.waiting.push(item);
    });
  }

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.releaseNext();
    }
  }

  private releaseNext(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.resolve();
    }
  }
}

// ── Singleton ──

let instance: ConcurrencyQueue | null = null;

export function getGenerateQueue(
  maxConcurrent = 3,
  timeoutMs = 30_000,
): ConcurrencyQueue {
  if (!instance) {
    instance = new ConcurrencyQueue(maxConcurrent, timeoutMs);
  }
  return instance;
}

export function resetGenerateQueue(): void {
  instance?.drain();
  instance = null;
}
