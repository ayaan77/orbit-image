import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/lib/logging/logger";

describe("createLogger", () => {
  const originalEnv = process.env.LOG_LEVEL;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalEnv;
    vi.restoreAllMocks();
  });

  it("outputs structured JSON with context", () => {
    process.env.LOG_LEVEL = "info";
    const log = createLogger({ requestId: "req_123", module: "test" });
    log.info("Test message", { extra: "data" });

    expect(console.log).toHaveBeenCalledTimes(1);
    const output = JSON.parse((console.log as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(output.level).toBe("info");
    expect(output.message).toBe("Test message");
    expect(output.requestId).toBe("req_123");
    expect(output.module).toBe("test");
    expect(output.extra).toBe("data");
    expect(output.timestamp).toBeDefined();
  });

  it("uses console.error for error level", () => {
    process.env.LOG_LEVEL = "debug";
    const log = createLogger();
    log.error("Something broke");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("uses console.warn for warn level", () => {
    process.env.LOG_LEVEL = "debug";
    const log = createLogger();
    log.warn("Warning");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("filters messages below configured level", () => {
    process.env.LOG_LEVEL = "warn";
    const log = createLogger();
    log.debug("Debug message");
    log.info("Info message");
    log.warn("Warn message");
    log.error("Error message");

    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("defaults to info level when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    const log = createLogger();
    log.debug("Debug message");
    log.info("Info message");

    expect(console.log).toHaveBeenCalledTimes(1); // only info, not debug
  });
});
