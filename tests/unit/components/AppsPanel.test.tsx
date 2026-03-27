// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AppsPanel } from "@/components/AppsPanel";

vi.mock("@/lib/client/storage", () => ({
  getApiKey: () => "test-master-key",
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/CodeBlock", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="code-block">{code}</pre>,
}));

vi.mock("@/lib/client/snippets", () => ({
  getSyncSnippet: () => "curl example",
  getAsyncSnippet: () => "async curl example",
}));

describe("AppsPanel", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, clients: [] }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    render(<AppsPanel />);
    await waitFor(() => {
      expect(screen.getAllByText(/active apps/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty state when no clients", async () => {
    render(<AppsPanel />);
    await waitFor(() => {
      // Actual empty state text in the component
      expect(screen.getAllByText(/no connected apps yet/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders client list when clients exist", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        clients: [
          {
            clientId: "abc123",
            clientName: "My App",
            createdAt: new Date().toISOString(),
            active: true,
          },
        ],
      }),
    });

    render(<AppsPanel />);
    await waitFor(() => {
      expect(screen.getAllByText("My App").length).toBeGreaterThanOrEqual(1);
    });
  });
});
