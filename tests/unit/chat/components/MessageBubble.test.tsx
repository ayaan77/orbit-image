// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
vi.mock("@/lib/client/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

// ── Mock ChatProvider ───────────────────────────────────────────────────
vi.mock("@/components/chat/ChatProvider", () => ({
  useChatContext: () => createMockChatContext(),
  ChatContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
}));

import { MessageBubble } from "@/components/chat/MessageBubble";

const baseMessage: Message = {
  id: "msg-1",
  channelId: "ch-1",
  userId: "user-1",
  username: "alice",
  content: "Hello world",
  type: "text",
  parentId: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  reactions: [],
  replyCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MessageBubble", () => {
  it("renders message content and username", () => {
    render(
      <MessageBubble
        message={baseMessage}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows avatar initial", () => {
    render(
      <MessageBubble
        message={baseMessage}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("highlights @mentions in content", () => {
    const msgWithMention: Message = {
      ...baseMessage,
      content: "Hey @bob check this out",
    };

    render(
      <MessageBubble
        message={msgWithMention}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const mentions = screen.getAllByTestId("mention");
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toHaveTextContent("@bob");
  });

  it("highlights multiple @mentions", () => {
    const msgWithMentions: Message = {
      ...baseMessage,
      content: "@alice and @bob please review",
    };

    render(
      <MessageBubble
        message={msgWithMentions}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const mentions = screen.getAllByTestId("mention");
    expect(mentions).toHaveLength(2);
  });

  it("shows deleted state when deletedAt is set", () => {
    const deletedMsg: Message = {
      ...baseMessage,
      deletedAt: new Date().toISOString(),
    };

    render(
      <MessageBubble
        message={deletedMsg}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("deleted-message")).toBeInTheDocument();
    expect(screen.getByText("(message deleted)")).toBeInTheDocument();
    // Content should not be rendered
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument();
  });

  it("shows thread preview when replyCount > 0", () => {
    const msgWithReplies: Message = {
      ...baseMessage,
      replyCount: 3,
    };

    render(
      <MessageBubble
        message={msgWithReplies}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId("thread-preview")).toBeInTheDocument();
    expect(screen.getByText(/3 replies/)).toBeInTheDocument();
  });

  it("does not show thread preview when replyCount is 0", () => {
    render(
      <MessageBubble
        message={baseMessage}
        onOpenThread={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId("thread-preview")).not.toBeInTheDocument();
  });
});
