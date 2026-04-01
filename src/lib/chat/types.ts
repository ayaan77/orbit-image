export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type MessageType = 'text' | 'image_share';

export interface Workspace {
  readonly id: string;
  readonly brandId: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly role?: WorkspaceRole; // caller's role in this workspace
}

export interface Channel {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string | null;
  readonly isDm: boolean;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly unreadMentions?: number;
}

export interface MessageImage {
  readonly messageId: string;
  readonly generationRef: string | null;
  readonly brand: string;
  readonly prompt: string;
  readonly model: string;
  readonly imageUrl: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface Reaction {
  readonly emoji: string;
  readonly count: number;
  readonly userReacted: boolean;
}

export interface Message {
  readonly id: string;
  readonly channelId: string;
  readonly userId: string;
  readonly username: string;
  readonly content: string;
  readonly type: MessageType;
  readonly parentId: string | null;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly imageData?: MessageImage;
  readonly reactions?: readonly Reaction[];
  readonly replyCount?: number;
}

export interface Mention {
  readonly id: string;
  readonly messageId: string;
  readonly mentionedUserId: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface ImageShareData {
  readonly imageUrl: string;
  readonly imageBase64?: string;
  readonly prompt: string;
  readonly model: string;
  readonly brand: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly generationRef?: string;
}

export interface MemberSummary {
  readonly id: string;
  readonly username: string;
  readonly role: WorkspaceRole;
}

export interface StudioContext {
  readonly prompt: string;
  readonly model: string;
  readonly brand: string;
  readonly feedback?: string;
}

export interface ChatContextValue {
  readonly activeWorkspaceId: string | null;
  readonly activeChannelId: string | null;
  readonly isPanelOpen: boolean;
  readonly unreadMentionCount: number;
  readonly pendingShare: ImageShareData | null;
  readonly pusherClient: unknown | null; // Pusher instance (typed as unknown to avoid exposing pusher-js in types)
  readonly currentUserId: string | null;
  readonly openPanel: (channelId?: string) => void;
  readonly closePanel: () => void;
  readonly setActiveWorkspace: (workspaceId: string) => void;
  readonly activeChannelName: string | null;
  readonly setActiveChannel: (channelId: string, channelName?: string) => void;
  readonly shareImage: (data: ImageShareData) => void;
  readonly clearPendingShare: () => void;
  readonly openStudioWithContext: (ctx: StudioContext) => void;
}
