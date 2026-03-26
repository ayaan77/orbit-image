import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ConcurrencyQueue,
  getGenerateQueue,
  resetGenerateQueue,
} from "@/lib/queue/concurrency-queue";
import { QueueTimeoutError } from "@/lib/queue/errors";

describe("ConcurrencyQueue", () => {
  let queue: ConcurrencyQueue;

  beforeEach(() => {
    resetGenerateQueue();
    queue = new ConcurrencyQueue(2, 5000);
  });

  it("executes immediately when below concurrency limit", async () => {
    const result = await queue.enqueue(() => Promise.resolve("done"));
    expect(result).toBe("done");
  });

  it("respects max concurrency", async () => {
    let concurrentCount = 0;
    let maxObserved = 0;

    const task = () =>
      new Promise<void>((resolve) => {
        concurrentCount++;
        maxObserved = Math.max(maxObserved, concurrentCount);
        setTimeout(() => {
          concurrentCount--;
          resolve();
        }, 50);
      });

    await Promise.all([
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
    ]);

    expect(maxObserved).toBe(2);
  });

  it("processes queued items in FIFO order", async () => {
    const order: number[] = [];
    const slow = new ConcurrencyQueue(1, 5000);

    const task = (id: number) => async () => {
      order.push(id);
      await new Promise((r) => setTimeout(r, 20));
    };

    await Promise.all([
      slow.enqueue(task(1)),
      slow.enqueue(task(2)),
      slow.enqueue(task(3)),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("rejects with QueueTimeoutError after timeout", async () => {
    const shortQueue = new ConcurrencyQueue(1, 50);

    // Fill the slot with a long-running task
    const blocker = shortQueue.enqueue(
      () => new Promise((r) => setTimeout(r, 200)),
    );

    // This one should time out
    await expect(
      shortQueue.enqueue(() => Promise.resolve("never")),
    ).rejects.toThrow(QueueTimeoutError);

    await blocker;
  });

  it("reports correct stats", async () => {
    expect(queue.getStats()).toEqual({
      active: 0,
      queued: 0,
      maxConcurrent: 2,
    });

    let resolve1!: () => void;
    let resolve2!: () => void;
    const p1 = queue.enqueue(
      () => new Promise<void>((r) => { resolve1 = r; }),
    );
    const p2 = queue.enqueue(
      () => new Promise<void>((r) => { resolve2 = r; }),
    );

    // Both slots filled
    expect(queue.getStats().active).toBe(2);
    expect(queue.getStats().queued).toBe(0);

    // Add one more — goes to queue
    const p3 = queue.enqueue(() => Promise.resolve());
    expect(queue.getStats().queued).toBe(1);

    resolve1();
    await p1;
    // p3 should now be executing
    await p3;
    resolve2();
    await p2;
  });

  it("releases slot when task fails", async () => {
    const failing = queue.enqueue(() => Promise.reject(new Error("boom")));
    await expect(failing).rejects.toThrow("boom");

    // Slot should be released — next task should execute
    const result = await queue.enqueue(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("drain rejects all pending items", async () => {
    const slow = new ConcurrencyQueue(1, 5000);

    // Fill the slot
    const blocker = slow.enqueue(
      () => new Promise((r) => setTimeout(r, 200)),
    );

    // Queue some items
    const p1 = slow.enqueue(() => Promise.resolve("a"));
    const p2 = slow.enqueue(() => Promise.resolve("b"));

    slow.drain();

    await expect(p1).rejects.toThrow("Queue drained");
    await expect(p2).rejects.toThrow("Queue drained");

    await blocker;
  });
});

describe("getGenerateQueue singleton", () => {
  beforeEach(() => {
    resetGenerateQueue();
  });

  it("returns the same instance on repeated calls", () => {
    const a = getGenerateQueue(3, 30000);
    const b = getGenerateQueue(3, 30000);
    expect(a).toBe(b);
  });

  it("creates a new instance after reset", () => {
    const a = getGenerateQueue(3, 30000);
    resetGenerateQueue();
    const b = getGenerateQueue(3, 30000);
    expect(a).not.toBe(b);
  });
});
