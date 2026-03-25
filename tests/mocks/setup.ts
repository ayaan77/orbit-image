import { vi } from "vitest";

// Mock environment variables for all tests
vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
vi.stubEnv("API_SECRET_KEY", "test-secret");
vi.stubEnv("CORTEX_BASE_URL", "https://cortex.test.com/api/mcp");
vi.stubEnv("DEFAULT_BRAND", "apexure");
vi.stubEnv("CACHE_TTL_SECONDS", "3600");
vi.stubEnv("RATE_LIMIT_PER_MINUTE", "60");
