export class QueueTimeoutError extends Error {
  readonly name = "QueueTimeoutError";

  constructor(timeoutMs: number) {
    super(`Request queued but timed out after ${timeoutMs}ms. Server is busy.`);
  }
}
