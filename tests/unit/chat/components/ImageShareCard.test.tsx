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

import { ImageShareCard } from "@/components/chat/ImageShareCard";

const imageShareMessage: Message = {
  id: "msg-img-1",
  channelId: "ch-1",
  userId: "user-1",
  username: "alice",
  content: "",
  type: "image_share",
  parentId: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  imageData: {
    messageId: "msg-img-1",
    generationRef: "gen-1",
    brand: "apexure",
    prompt: "A stunning mountain landscape at sunset with golden light",
    model: "gpt-image-1",
    imageUrl: "https://example.com/test-image.png",
    mimeType: "image/png",
    dimensions: { width: 1024, height: 1024 },
  },
  reactions: [],
  replyCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ImageShareCard", () => {
  it("renders image with correct URL", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
      />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/test-image.png");
  });

  it("renders brand and model badges", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
      />
    );

    expect(screen.getByText("apexure")).toBeInTheDocument();
    expect(screen.getByText("gpt-image-1")).toBeInTheDocument();
  });

  it("renders prompt text", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
      />
    );

    expect(
      screen.getByText("A stunning mountain landscape at sunset with golden light")
    ).toBeInTheDocument();
  });

  it("shows Regenerate button for message author", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
        currentUserId="user-1"
      />
    );

    expect(screen.getByTestId("regenerate-btn")).toBeInTheDocument();
    expect(screen.getByText("Regenerate with feedback")).toBeInTheDocument();
  });

  it("does not show Regenerate button for non-author", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
        currentUserId="user-other"
      />
    );

    expect(screen.queryByTestId("regenerate-btn")).not.toBeInTheDocument();
  });

  it("renders username and avatar initial", () => {
    render(
      <ImageShareCard
        message={imageShareMessage}
        onOpenThread={vi.fn()}
      />
    );

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("returns null when imageData is missing", () => {
    const msgNoImage: Message = {
      ...imageShareMessage,
      imageData: undefined,
    };

    const { container } = render(
      <ImageShareCard
        message={msgNoImage}
        onOpenThread={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
