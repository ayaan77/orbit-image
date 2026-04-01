import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { User } from '@/lib/auth/types';

// ─── Mocks ───

vi.mock('@/lib/middleware/auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/middleware/validation', () => ({
  validateRequestBody: vi.fn(),
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/chat/db', () => ({
  ChatError: class ChatError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ChatError';
      this.status = status;
    }
  },
  getMessages: vi.fn(),
  createMessage: vi.fn(),
  getChannelById: vi.fn(),
  requireWorkspaceMember: vi.fn(),
  insertImageData: vi.fn(),
}));

vi.mock('@/lib/chat/mentions', () => ({
  parseMentions: vi.fn(),
  insertMentions: vi.fn(),
}));

vi.mock('@/lib/chat/pusher', () => ({
  triggerPusher: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import {
  getMessages,
  createMessage,
  getChannelById,
  requireWorkspaceMember,
  insertImageData,
} from '@/lib/chat/db';
import { parseMentions, insertMentions } from '@/lib/chat/mentions';
import { triggerPusher } from '@/lib/chat/pusher';
import {
  GET,
  POST,
} from '@/app/api/chat/channels/[cid]/messages/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockValidateBody = vi.mocked(validateRequestBody);
const mockRateLimit = vi.mocked(checkRateLimit);
const mockGetMessages = vi.mocked(getMessages);
const mockCreateMessage = vi.mocked(createMessage);
const mockGetChannel = vi.mocked(getChannelById);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockInsertImageData = vi.mocked(insertImageData);
const mockParseMentions = vi.mocked(parseMentions);
const mockInsertMentions = vi.mocked(insertMentions);
const mockTriggerPusher = vi.mocked(triggerPusher);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const TEST_CHANNEL = {
  id: 'ch_1',
  workspaceId: 'ws_1',
  name: 'general',
  description: null,
  isDm: false,
  createdBy: 'usr_test1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const TEST_MESSAGE = {
  id: 'msg_1',
  channelId: 'ch_1',
  userId: 'usr_test1',
  username: 'testuser',
  content: 'Hello world',
  type: 'text' as const,
  parentId: null,
  deletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  reactions: [],
  replyCount: 0,
};

const paramsPromise = Promise.resolve({ cid: 'ch_1' });

function makeRequest(method = 'GET', query = ''): Request {
  return new Request(
    `http://localhost:3000/api/chat/channels/ch_1/messages${query}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method === 'POST'
        ? { body: JSON.stringify({ content: 'Hello world' }) }
        : {}),
    },
  );
}

describe('GET /api/chat/channels/[cid]/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Missing authentication');
  });

  it('returns 404 when channel not found', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(null);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Channel not found');
  });

  it('returns paginated messages', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(TEST_CHANNEL);
    mockRequireMember.mockResolvedValue('member');
    mockGetMessages.mockResolvedValue([TEST_MESSAGE]);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].content).toBe('Hello world');
    expect(data.hasMore).toBe(false);
  });
});

describe('POST /api/chat/channels/[cid]/messages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a message with Pusher notification', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRateLimit.mockResolvedValue(null);
    mockGetChannel.mockResolvedValue(TEST_CHANNEL);
    mockRequireMember.mockResolvedValue('member');
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { content: 'Hello @bob', type: 'text' },
    } as any);
    mockCreateMessage.mockResolvedValue(TEST_MESSAGE);
    mockParseMentions.mockResolvedValue(['usr_bob']);
    mockInsertMentions.mockResolvedValue();
    mockTriggerPusher.mockResolvedValue();

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.message.id).toBe('msg_1');

    // Verify Pusher was called for the channel message
    expect(mockTriggerPusher).toHaveBeenCalledWith(
      'private-channel-ch_1',
      'message.created',
      expect.objectContaining({
        message: TEST_MESSAGE,
        author: { id: 'usr_test1', username: 'testuser' },
      }),
    );

    // Verify mention notification was sent
    expect(mockTriggerPusher).toHaveBeenCalledWith(
      'private-mentions-usr_bob',
      'mention.created',
      expect.objectContaining({
        messageId: 'msg_1',
        channelId: 'ch_1',
        from: { id: 'usr_test1', username: 'testuser' },
      }),
    );

    expect(mockInsertMentions).toHaveBeenCalledWith('msg_1', ['usr_bob']);
  });

  it('sends image_share message with image data', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRateLimit.mockResolvedValue(null);
    mockGetChannel.mockResolvedValue(TEST_CHANNEL);
    mockRequireMember.mockResolvedValue('member');

    const imageData = {
      brand: 'apexure',
      prompt: 'test prompt',
      model: 'gpt-image-1',
      imageUrl: 'https://example.com/img.png',
      mimeType: 'image/png',
      dimensions: { width: 1024, height: 1024 },
    };

    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        content: 'Check out this image',
        type: 'image_share',
        imageData,
      },
    } as any);
    mockCreateMessage.mockResolvedValue({
      ...TEST_MESSAGE,
      type: 'image_share',
    });
    mockParseMentions.mockResolvedValue([]);
    mockTriggerPusher.mockResolvedValue();
    mockInsertImageData.mockResolvedValue();

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockInsertImageData).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg_1',
        brand: 'apexure',
      }),
    );
  });

  it('returns rate limit error when limited', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    const rateLimitRes = NextResponse.json(
      {
        success: false as const,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      },
      { status: 429 },
    );
    mockRateLimit.mockResolvedValue(rateLimitRes);

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
