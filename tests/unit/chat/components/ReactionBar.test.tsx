// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Reaction } from "@/lib/chat/types";
import { createMockChatContext } from "./mock-context";

// ── Mock pusher-js ──────────────────────────────────────────────────────
vi.mock("pusher-js", () => ({
  default: vi.fn(),
}));

// ── Mock next/navigation ────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Mock apiFetch ───────────────────────────────────────────────────────
const mockApiFetch = vi.fn();
vi.mock("@/lib/client/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// ── Mock ChatProvider ───────────────────────────────────────────────────
vi.mock("@/components/chat/ChatProvider", () => ({
  useChatContext: () => createMockChatContext(),
  ChatContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
}));

import { ReactionBar } from "@/components/chat/ReactionBar";

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("ReactionBar", () => {
  it("renders existing reactions with count", () => {
    const reactions: Reaction[] = [
      { emoji: "\u{1F44D}", count: 3, userReacted: false },
      { emoji: "\u{2764}\u{FE0F}", count: 1, userReacted: true },
    ];

    render(<ReactionBar messageId="msg-1" reactions={reactions} />);

    const pills = screen.getAllByTestId("reaction-pill");
    expect(pills).toHaveLength(2);
    expect(pills[0]).toHaveTextContent("3");
    expect(pills[1]).toHaveTextContent("1");
  });

  it("highlights user-reacted emoji pill", () => {
    const reactions: Reaction[] = [
      { emoji: "\u{1F44D}", count: 1, userReacted: true },
    ];

    render(<ReactionBar messageId="msg-1" reactions={reactions} />);

    const pill = screen.getByTestId("reaction-pill");
    expect(pill.className).toContain("pillActive");
  });

  it("does not highlight non-user-reacted emoji pill", () => {
    const reactions: Reaction[] = [
      { emoji: "\u{1F44D}", count: 2, userReacted: false },
    ];

    render(<ReactionBar messageId="msg-1" reactions={reactions} />);

    const pill = screen.getByTestId("reaction-pill");
    expect(pill.className).not.toContain("pillActive");
  });

  it("calls API when clicking an existing reaction", async () => {
    const reactions: Reaction[] = [
      { emoji: "\u{1F44D}", count: 1, userReacted: false },
    ];

    render(<ReactionBar messageId="msg-1" reactions={reactions} />);

    const pill = screen.getByTestId("reaction-pill");
    await userEvent.click(pill);

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/chat/messages/msg-1/reactions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ emoji: "\u{1F44D}" }),
      })
    );
  });

  it("shows emoji picker on + button click", async () => {
    render(<ReactionBar messageId="msg-1" reactions={[]} />);

    expect(screen.queryByTestId("emoji-picker")).not.toBeInTheDocument();

    const addBtn = screen.getByTestId("add-reaction-btn");
    await userEvent.click(addBtn);

    expect(screen.getByTestId("emoji-picker")).toBeInTheDocument();
  });

  it("calls API when selecting emoji from picker", async () => {
    render(<ReactionBar messageId="msg-1" reactions={[]} />);

    // Open picker
    const addBtn = screen.getByTestId("add-reaction-btn");
    await userEvent.click(addBtn);

    // Click first emoji in picker
    const picker = screen.getByTestId("emoji-picker");
    const emojiButtons = picker.querySelectorAll("button");
    expect(emojiButtons.length).toBeGreaterThan(0);

    await userEvent.click(emojiButtons[0]);

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/chat/messages/msg-1/reactions",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("renders add reaction button", () => {
    render(<ReactionBar messageId="msg-1" reactions={[]} />);

    expect(screen.getByTestId("add-reaction-btn")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });
});
