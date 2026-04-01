// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMockChatContext } from "../chat/components/mock-context";
import type { ImageShareData } from "@/lib/chat/types";

// ── Mocks that must be hoisted before imports ─────────────────────────────

vi.mock("pusher-js", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/client/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
}));

// Mock ChatProvider — controlled via mockChatCtx variable
let mockChatCtx = createMockChatContext();

vi.mock("@/components/chat/ChatProvider", () => ({
  useChatContext: () => mockChatCtx,
  ChatContext: {
    Provider: ({ children }: { children: ReactNode }) => children,
  },
}));

// Mock ChannelPickerModal — renders a sentinel div so we can assert it mounted
vi.mock("@/components/chat/ChannelPickerModal", () => ({
  ChannelPickerModal: ({ onClose }: { onClose: () => void; imageData: ImageShareData }) => (
    <div data-testid="channel-picker-modal">
      <button onClick={onClose} data-testid="channel-picker-close">Close</button>
    </div>
  ),
}));

// ── Controlled searchParams ───────────────────────────────────────────────
let mockSearchParamsMap: Record<string, string | null> = {};
const mockSearchParams = {
  get: (key: string) => mockSearchParamsMap[key] ?? null,
};

// ── Import component under test ───────────────────────────────────────────
import StudioPage from "@/app/studio/page";

// ── Helpers ───────────────────────────────────────────────────────────────

/** Render the page and simulate a successful generation result. */
async function renderWithResult(overrideCtx?: Partial<typeof mockChatCtx>) {
  if (overrideCtx) {
    mockChatCtx = createMockChatContext(overrideCtx);
  }

  const { container } = render(<StudioPage />);

  // The page starts in "input view". We need to inject a result to show the result view.
  // The simplest way is to set topic + trigger generate. We mock fetch in each test
  // that needs a result, or we directly manipulate state via the textarea + button.
  return { container };
}

// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParamsMap = {};
  mockChatCtx = createMockChatContext();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Studio — URL param pre-fill (Regenerate with feedback flow)", () => {
  it("pre-fills topic from prompt param", async () => {
    mockSearchParamsMap = { prompt: "a snowy mountain", model: null, brand: null, feedback: null };

    render(<StudioPage />);

    const textarea = screen.getByPlaceholderText(/A modern SaaS dashboard/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("a snowy mountain");
  });

  it("appends feedback to topic when feedback param is present", async () => {
    mockSearchParamsMap = {
      prompt: "a snowy mountain",
      model: null,
      brand: null,
      feedback: "make it warmer",
    };

    render(<StudioPage />);

    const textarea = screen.getByPlaceholderText(/A modern SaaS dashboard/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("a snowy mountain\n\nFeedback: make it warmer");
  });

  it("does not override topic if prompt param is absent", async () => {
    mockSearchParamsMap = {};

    render(<StudioPage />);

    const textarea = screen.getByPlaceholderText(/A modern SaaS dashboard/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("shows model selector expanded when model param matches a known model", async () => {
    mockSearchParamsMap = { prompt: "test image", model: "dall-e-3", brand: null, feedback: null };

    render(<StudioPage />);

    // Model row should be visible because setShowAdvanced(true) was called
    expect(screen.getByText("DALL-E 3")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Studio — Share to Channel button", () => {
  const mockFetchResponse = {
    ok: true,
    json: async () => ({
      success: true,
      images: [
        {
          url: "https://example.com/generated.png",
          mimeType: "image/png",
          dimensions: { width: 1024, height: 1024 },
        },
      ],
      brand: "testbrand",
      metadata: { processingTimeMs: 1234, brandContextUsed: true, demo: false },
    }),
  };

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);
  });

  async function generateAndGetResult() {
    render(<StudioPage />);

    const textarea = screen.getByPlaceholderText(/A modern SaaS dashboard/i);
    fireEvent.change(textarea, { target: { value: "test image prompt" } });

    const generateBtn = screen.getByText("Generate");
    await act(async () => {
      fireEvent.click(generateBtn);
    });
  }

  it("renders Share to Channel button after generation", async () => {
    await generateAndGetResult();
    expect(screen.getByTestId("share-to-channel-btn")).toBeInTheDocument();
  });

  it("calls shareImage with correct data when Share to Channel is clicked", async () => {
    const shareImageMock = vi.fn();
    mockChatCtx = createMockChatContext({ shareImage: shareImageMock });

    await generateAndGetResult();

    const btn = screen.getByTestId("share-to-channel-btn");
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(shareImageMock).toHaveBeenCalledOnce();
    const callArg: ImageShareData = shareImageMock.mock.calls[0][0];
    expect(callArg.imageUrl).toBe("https://example.com/generated.png");
    expect(callArg.prompt).toBe("test image prompt");
    expect(callArg.mimeType).toBe("image/png");
    expect(callArg.dimensions).toEqual({ width: 1024, height: 1024 });
  });

  it("uploads base64 via API route before calling shareImage when result has no URL", async () => {
    // fetch is called twice: once for generate, once for upload-blob
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          images: [
            {
              base64: "abc123",
              mimeType: "image/png",
              dimensions: { width: 512, height: 512 },
            },
          ],
          brand: "testbrand",
          metadata: { processingTimeMs: 500, brandContextUsed: false, demo: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://blob.example.com/img.png" }),
      });

    const shareImageMock = vi.fn();
    mockChatCtx = createMockChatContext({ shareImage: shareImageMock });

    render(<StudioPage />);
    const textarea = screen.getByPlaceholderText(/A modern SaaS dashboard/i);
    fireEvent.change(textarea, { target: { value: "base64 test prompt" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Generate"));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("share-to-channel-btn"));
    });

    // Verify the upload-blob API route was called with the base64 payload
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const uploadCall = fetchMock.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("upload-blob")
    );
    expect(uploadCall).toBeDefined();
    const uploadBody = JSON.parse((uploadCall![1] as RequestInit).body as string);
    expect(uploadBody.base64).toBe("abc123");
    expect(uploadBody.mimeType).toBe("image/png");

    expect(shareImageMock).toHaveBeenCalledOnce();
    const callArg: ImageShareData = shareImageMock.mock.calls[0][0];
    expect(callArg.imageUrl).toBe("https://blob.example.com/img.png");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Studio — ChannelPickerModal", () => {
  it("renders ChannelPickerModal when pendingShare is set in context", () => {
    const pendingShare: ImageShareData = {
      imageUrl: "https://example.com/img.png",
      prompt: "test prompt",
      model: "gpt-image-1",
      brand: "apexure",
      mimeType: "image/png",
      dimensions: { width: 1024, height: 1024 },
    };

    mockChatCtx = createMockChatContext({ pendingShare });

    render(<StudioPage />);

    expect(screen.getByTestId("channel-picker-modal")).toBeInTheDocument();
  });

  it("does not render ChannelPickerModal when pendingShare is null", () => {
    mockChatCtx = createMockChatContext({ pendingShare: null });

    render(<StudioPage />);

    expect(screen.queryByTestId("channel-picker-modal")).not.toBeInTheDocument();
  });

  it("calls clearPendingShare when modal is closed", () => {
    const clearPendingShareMock = vi.fn();
    const pendingShare: ImageShareData = {
      imageUrl: "https://example.com/img.png",
      prompt: "test",
      model: "gpt-image-1",
      brand: "apexure",
      mimeType: "image/png",
      dimensions: { width: 1024, height: 1024 },
    };

    mockChatCtx = createMockChatContext({ pendingShare, clearPendingShare: clearPendingShareMock });

    render(<StudioPage />);

    fireEvent.click(screen.getByTestId("channel-picker-close"));

    expect(clearPendingShareMock).toHaveBeenCalledOnce();
  });
});
