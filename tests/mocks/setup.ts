import { vi, beforeAll, afterEach, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { resetEnvCache } from "@/lib/config/env";

// Mock next/server's `after` — in tests it just awaits the promise/runs the callback
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (taskOrPromise: unknown) => {
      if (taskOrPromise instanceof Promise) {
        taskOrPromise.catch(() => {});
      }
    },
  };
});

// Mock environment variables for all tests
vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
vi.stubEnv("API_SECRET_KEY", "test-secret");
vi.stubEnv("CORTEX_BASE_URL", "https://cortex.test.apexure.com/api/mcp");
vi.stubEnv("DEFAULT_BRAND", "apexure");
vi.stubEnv("CACHE_TTL_SECONDS", "3600");
vi.stubEnv("RATE_LIMIT_PER_MINUTE", "60");

// Set up MSW server for HTTP mocking
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => resetEnvCache());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
