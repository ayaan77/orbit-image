// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMockChatContext } from "./mock-context";

// ── Mock pusher-js ──────────────────────────────────────────────────────
vi.mock("pusher-js", () => ({
  default: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue({ bind: vi.fn(), unbind_all: vi.fn() }),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// ── Mock next/navigation ────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Mock apiFetch ───────────────────────────────────────────────────────
vi.mock("@/lib/client/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }),
}));

// ── Mock ChatProvider ───────────────────────────────────────────────────
let mockContext = createMockChatContext();

vi.mock("@/components/chat/ChatProvider", () => ({
  useChatContext: () => mockContext,
  ChatContext: {
    Provider: ({ children, value }: { children: ReactNode; value: unknown }) => children,
  },
}));

import { ChatPanel } from "@/components/chat/ChatPanel";

beforeEach(() => {
  vi.clearAllMocks();
  mockContext = createMockChatContext();
});

describe("ChatPanel", () => {
  it("renders with open class when isPanelOpen is true", () => {
    mockContext = createMockChatContext({ isPanelOpen: true });
    render(<ChatPanel />);

    const panel = screen.getByTestId("chat-panel");
    expect(panel).toBeInTheDocument();
    expect(panel.className).toContain("open");
  });

  it("renders without open class when isPanelOpen is false", () => {
    mockContext = createMockChatContext({ isPanelOpen: false });
    render(<ChatPanel />);

    const panel = screen.getByTestId("chat-panel");
    expect(panel).toBeInTheDocument();
    expect(panel.className).not.toContain("open");
  });

  it("calls closePanel when close button is clicked", async () => {
    const closePanelFn = vi.fn();
    mockContext = createMockChatContext({ isPanelOpen: true, closePanel: closePanelFn });

    render(<ChatPanel />);

    const closeBtn = screen.getByTestId("chat-close-btn");
    await userEvent.click(closeBtn);

    expect(closePanelFn).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no activeChannelId", () => {
    mockContext = createMockChatContext({ isPanelOpen: true, activeChannelId: null });
    render(<ChatPanel />);

    expect(screen.getByText("Select a channel to start chatting")).toBeInTheDocument();
  });

  it("has correct aria attributes", () => {
    mockContext = createMockChatContext({ isPanelOpen: true });
    render(<ChatPanel />);

    const panel = screen.getByTestId("chat-panel");
    expect(panel).toHaveAttribute("role", "dialog");
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(panel).toHaveAttribute("aria-label", "Chat panel");
  });
});
