import { expect, vi } from "vitest";
import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers (toBeInTheDocument, toBeDisabled, etc.)
expect.extend(matchers);

// Mock next/dynamic — render nothing during tests (avoids async lazy load issues)
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));
