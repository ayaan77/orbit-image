import { vi } from "vitest";
import type { ChatContextValue, ImageShareData, StudioContext } from "@/lib/chat/types";

export function createMockChatContext(
  overrides: Partial<ChatContextValue> = {}
): ChatContextValue {
  return {
    activeWorkspaceId: "ws-1",
    activeChannelId: "ch-1",
    isPanelOpen: false,
    unreadMentionCount: 0,
    pendingShare: null,
    pusherClient: null,
    activeChannelName: null,
    currentUserId: null,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    setActiveWorkspace: vi.fn(),
    setActiveChannel: vi.fn(),
    shareImage: vi.fn(),
    clearPendingShare: vi.fn(),
    openStudioWithContext: vi.fn(),
    ...overrides,
  };
}
