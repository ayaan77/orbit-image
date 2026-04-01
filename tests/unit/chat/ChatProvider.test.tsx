// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// ── Mock pusher-js before any imports ─────────────────────────────────
const mockUnbindAll = vi.fn();
const mockUnsubscribe = vi.fn();
const mockDisconnect = vi.fn();
const mockSubscribe = vi.fn().mockImplementation((channelName: string) => ({
  name: channelName,
  bind: vi.fn(),
  unbind_all: mockUnbindAll,
}));

vi.mock("pusher-js", () => ({
  default: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    disconnect: mockDisconnect,
  })),
}));

// ── Mock next/navigation ──────────────────────────────────────────────
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ── Mock apiFetch ──────────────────────────────────────────────────────
vi.mock("@/lib/client/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/client/api";
import { ChatProvider, useChatContext } from "@/components/chat/ChatProvider";
import type { ImageShareData, StudioContext } from "@/lib/chat/types";

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

// Helper: default happy-path fetch responses
function setupDefaultFetchMocks() {
  mockApiFetch.mockImplementation(async (url: string) => {
    if (url === "/api/chat/workspaces") {
      return {
        ok: true,
        json: async () => [
          { id: "ws-1", brandId: "brand-1", name: "Workspace 1", slug: "workspace-1" },
        ],
      };
    }
    if (url === "/api/chat/mentions") {
      return {
        ok: true,
        json: async () => ({ unreadCount: 3 }),
      };
    }
    if (url === "/api/auth/me") {
      return {
        ok: true,
        json: async () => ({ user: { id: "user-1", username: "alice" } }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <ChatProvider>{children}</ChatProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultFetchMocks();
  // NEXT_PUBLIC_PUSHER_KEY is not set in test env — Pusher init is skipped
  delete process.env.NEXT_PUBLIC_PUSHER_KEY;
});

// ── useChatContext outside provider ───────────────────────────────────
describe("useChatContext", () => {
  it("throws when used outside ChatProvider", () => {
    // Suppress expected React error output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useChatContext());
    }).toThrow("useChatContext must be used within ChatProvider");
    consoleSpy.mockRestore();
  });
});

// ── openPanel / closePanel ─────────────────────────────────────────────
describe("openPanel / closePanel", () => {
  it("openPanel() sets isPanelOpen to true", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    expect(result.current.isPanelOpen).toBe(false);

    await act(async () => {
      result.current.openPanel();
    });

    expect(result.current.isPanelOpen).toBe(true);
  });

  it("closePanel() sets isPanelOpen to false after openPanel", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    await act(async () => {
      result.current.openPanel();
    });
    expect(result.current.isPanelOpen).toBe(true);

    await act(async () => {
      result.current.closePanel();
    });
    expect(result.current.isPanelOpen).toBe(false);
  });

  it("openPanel(channelId) sets activeChannelId and opens panel", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    await act(async () => {
      result.current.openPanel("ch-42");
    });

    expect(result.current.isPanelOpen).toBe(true);
    expect(result.current.activeChannelId).toBe("ch-42");
  });
});

// ── shareImage ────────────────────────────────────────────────────────
describe("shareImage", () => {
  it("sets pendingShare and opens the panel", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    const data: ImageShareData = {
      imageUrl: "https://example.com/img.png",
      prompt: "a red fox",
      model: "gpt-image-1",
      brand: "apexure",
      mimeType: "image/png",
      dimensions: { width: 1024, height: 1024 },
    };

    await act(async () => {
      result.current.shareImage(data);
    });

    expect(result.current.pendingShare).toEqual(data);
    expect(result.current.isPanelOpen).toBe(true);
  });

  it("clearPendingShare() nullifies pendingShare", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    const data: ImageShareData = {
      imageUrl: "https://example.com/img.png",
      prompt: "test",
      model: "gpt-image-1",
      brand: "apexure",
      mimeType: "image/png",
      dimensions: { width: 512, height: 512 },
    };

    await act(async () => {
      result.current.shareImage(data);
    });
    expect(result.current.pendingShare).not.toBeNull();

    await act(async () => {
      result.current.clearPendingShare();
    });
    expect(result.current.pendingShare).toBeNull();
  });
});

// ── openStudioWithContext ─────────────────────────────────────────────
describe("openStudioWithContext", () => {
  it("calls router.push with correct URL params (no feedback)", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    const ctx: StudioContext = {
      prompt: "a mountain at dusk",
      model: "flux-pro",
      brand: "apexure",
    };

    await act(async () => {
      result.current.openStudioWithContext(ctx);
    });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/studio?prompt=a+mountain+at+dusk&model=flux-pro&brand=apexure"
    );
  });

  it("includes feedback param when provided", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    const ctx: StudioContext = {
      prompt: "logo on white",
      model: "dall-e-3",
      brand: "testbrand",
      feedback: "make it bolder",
    };

    await act(async () => {
      result.current.openStudioWithContext(ctx);
    });

    const calledWith: string = mockRouterPush.mock.calls[0][0];
    const url = new URL(calledWith, "http://localhost");
    expect(url.pathname).toBe("/studio");
    expect(url.searchParams.get("prompt")).toBe("logo on white");
    expect(url.searchParams.get("model")).toBe("dall-e-3");
    expect(url.searchParams.get("brand")).toBe("testbrand");
    expect(url.searchParams.get("feedback")).toBe("make it bolder");
  });
});

// ── Bootstrap fetch calls ────────────────────────────────────────────
describe("on mount", () => {
  it("fetches workspaces and sets activeWorkspaceId to first result", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    // Wait for async bootstrap to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.activeWorkspaceId).toBe("ws-1");
  });

  it("fetches mentions and sets unreadMentionCount", async () => {
    const { result } = renderHook(() => useChatContext(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.unreadMentionCount).toBe(3);
  });

  it("handles failed workspaces fetch gracefully", async () => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url === "/api/chat/workspaces") return { ok: false, json: async () => ({}) };
      if (url === "/api/chat/mentions") return { ok: true, json: async () => ({ unreadCount: 0 }) };
      if (url === "/api/auth/me") return { ok: true, json: async () => ({ user: { id: "u1" } }) };
      return { ok: false, json: async () => ({}) };
    });

    const { result } = renderHook(() => useChatContext(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.activeWorkspaceId).toBeNull();
  });
});
