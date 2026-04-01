"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";
import type { Channel as PusherChannel } from "pusher-js";
import { apiFetch } from "@/lib/client/api";
import type {
  ChatContextValue,
  ImageShareData,
  StudioContext,
  Workspace,
} from "@/lib/chat/types";

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [unreadMentionCount, setUnreadMentionCount] = useState(0);
  const [pendingShare, setPendingShare] = useState<ImageShareData | null>(null);

  // Keep refs to Pusher channels so we can unsubscribe on cleanup
  const pusherRef = useRef<Pusher | null>(null);
  const channelRefs = useRef<PusherChannel[]>([]);

  // ── Open / close panel ──────────────────────────────────────────────
  const openPanel = useCallback((channelId?: string) => {
    if (channelId) {
      setActiveChannelIdState(channelId);
    }
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // ── Active workspace / channel setters ─────────────────────────────
  const setActiveWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
  }, []);

  const setActiveChannel = useCallback((channelId: string) => {
    setActiveChannelIdState(channelId);
  }, []);

  // ── Image sharing ───────────────────────────────────────────────────
  const shareImage = useCallback((data: ImageShareData) => {
    setPendingShare(data);
    setIsPanelOpen(true);
  }, []);

  const clearPendingShare = useCallback(() => {
    setPendingShare(null);
  }, []);

  // ── Studio navigation ───────────────────────────────────────────────
  const openStudioWithContext = useCallback(
    (ctx: StudioContext) => {
      const params = new URLSearchParams({
        prompt: ctx.prompt,
        model: ctx.model,
        brand: ctx.brand,
      });
      if (ctx.feedback) params.set("feedback", ctx.feedback);
      router.push(`/studio?${params.toString()}`);
    },
    [router]
  );

  // ── Bootstrap: fetch workspaces, mentions, and set up Pusher ───────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Fetch workspaces
      let workspaces: Workspace[] = [];
      try {
        const res = await apiFetch("/api/chat/workspaces");
        if (res.ok) {
          const data = await res.json();
          workspaces = Array.isArray(data) ? data : (data.workspaces ?? []);
        }
      } catch {
        // Network error — continue without workspaces
      }

      if (!cancelled && workspaces.length > 0) {
        setActiveWorkspaceIdState(workspaces[0].id);
      }

      // 2. Fetch unread mention count
      try {
        const res = await apiFetch("/api/chat/mentions");
        if (res.ok && !cancelled) {
          const data = await res.json();
          const count =
            typeof data.unreadCount === "number"
              ? data.unreadCount
              : Array.isArray(data)
              ? data.filter((m: { readAt: string | null }) => m.readAt === null).length
              : 0;
          setUnreadMentionCount(count);
        }
      } catch {
        // Ignore — mention count stays 0
      }

      // 3. Initialise Pusher (only if key is configured)
      const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
      if (!pusherKey) return;

      const pusher = new Pusher(pusherKey, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "mt1",
        authEndpoint: "/api/chat/pusher/auth",
      });
      pusherRef.current = pusher;

      // 4. Subscribe to per-workspace channels
      for (const ws of workspaces) {
        const ch = pusher.subscribe(`private-workspace-${ws.id}`);
        channelRefs.current.push(ch);
        // channel.created → no special client action needed at provider level
      }

      // 5. Fetch userId from /api/auth/me and subscribe to mention channel
      try {
        const meRes = await apiFetch("/api/auth/me");
        if (meRes.ok && !cancelled) {
          const meData = await meRes.json();
          const userId: string | undefined = meData?.user?.id ?? meData?.id;
          if (userId) {
            const mentionCh = pusher.subscribe(`private-mentions-${userId}`);
            channelRefs.current.push(mentionCh);
            mentionCh.bind("new-mention", () => {
              if (!cancelled) {
                setUnreadMentionCount((prev) => prev + 1);
              }
            });
          }
        }
      } catch {
        // Ignore — real-time mentions won't work but the app still functions
      }
    }

    init();

    return () => {
      cancelled = true;
      // Unsubscribe all Pusher channels
      for (const ch of channelRefs.current) {
        ch.unbind_all();
        pusherRef.current?.unsubscribe(ch.name);
      }
      channelRefs.current = [];
      // Disconnect Pusher client
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      activeWorkspaceId,
      activeChannelId,
      isPanelOpen,
      unreadMentionCount,
      pendingShare,
      pusherClient: pusherRef.current,
      openPanel,
      closePanel,
      setActiveWorkspace,
      setActiveChannel,
      shareImage,
      clearPendingShare,
      openStudioWithContext,
    }),
    [
      activeWorkspaceId,
      activeChannelId,
      isPanelOpen,
      unreadMentionCount,
      pendingShare,
      openPanel,
      closePanel,
      setActiveWorkspace,
      setActiveChannel,
      shareImage,
      clearPendingShare,
      openStudioWithContext,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
