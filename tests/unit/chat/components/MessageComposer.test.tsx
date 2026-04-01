// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Message } from "@/lib/chat/types";
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

import { MessageComposer } from "@/components/chat/MessageComposer";

const sentMessage: Message = {
  id: "msg-new",
  channelId: "ch-1",
  userId: "user-1",
  username: "alice",
  content: "Hello",
  type: "text",
  parentId: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => sentMessage,
  });
});

describe("MessageComposer", () => {
  it("renders textarea and send button", () => {
    render(
      <MessageComposer channelId="ch-1" onSent={vi.fn()} />
    );

    expect(screen.getByTestId("message-input")).toBeInTheDocument();
    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
  });

  it("send button is disabled when textarea is empty", () => {
    render(
      <MessageComposer channelId="ch-1" onSent={vi.fn()} />
    );

    const sendBtn = screen.getByTestId("send-btn");
    expect(sendBtn).toBeDisabled();
  });

  it("submits message on Enter key and calls onSent", async () => {
    const onSent = vi.fn();
    render(
      <MessageComposer channelId="ch-1" onSent={onSent} />
    );

    const input = screen.getByTestId("message-input");
    await userEvent.type(input, "Hello{enter}");

    // Wait for async operations
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/chat/channels/ch-1/messages",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(onSent).toHaveBeenCalledWith(sentMessage);
  });

  it("Shift+Enter inserts newline instead of submitting", async () => {
    const onSent = vi.fn();
    render(
      <MessageComposer channelId="ch-1" onSent={onSent} />
    );

    const input = screen.getByTestId("message-input");
    await userEvent.type(input, "line1{shift>}{enter}{/shift}line2");

    // Should NOT have submitted a message (messages endpoint not called)
    const messageCalls = mockApiFetch.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === "string" && (args[0] as string).includes("/messages")
    );
    expect(messageCalls).toHaveLength(0);
    expect(onSent).not.toHaveBeenCalled();
  });

  it("shows thread reply placeholder when parentId is provided", () => {
    render(
      <MessageComposer channelId="ch-1" parentId="parent-1" onSent={vi.fn()} />
    );

    const input = screen.getByTestId("message-input");
    expect(input).toHaveAttribute("placeholder", "Reply in thread...");
  });

  it("shows default placeholder when no parentId", () => {
    render(
      <MessageComposer channelId="ch-1" onSent={vi.fn()} />
    );

    const input = screen.getByTestId("message-input");
    expect(input).toHaveAttribute("placeholder", "Type a message...");
  });

  it("clears textarea after successful send", async () => {
    render(
      <MessageComposer channelId="ch-1" onSent={vi.fn()} />
    );

    const input = screen.getByTestId("message-input") as HTMLTextAreaElement;
    await userEvent.type(input, "Hello{enter}");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(input.value).toBe("");
  });
});
