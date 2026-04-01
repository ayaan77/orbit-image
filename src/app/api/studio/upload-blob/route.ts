import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { uploadImageToBlob } from '@/lib/mcp/blob';

// ~10 MB decoded  ≈ 13.4 MB base64
const MAX_BASE64_LENGTH = 13_981_014;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
// Alphanumeric plus safe punctuation only, 1–128 chars
const SAFE_FILENAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

const UploadSchema = z.object({
  base64: z.string().min(1).max(MAX_BASE64_LENGTH),
  mimeType: z.string(),
  filename: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.type === 'error') {
    return NextResponse.json({ error: auth.message }, { status: 401 });
  }

  // Only session users and API clients may upload; master key is not a user identity
  const userId =
    auth.type === 'user'
      ? auth.user.id
      : auth.type === 'client'
        ? auth.client.clientId
        : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10 uploads per minute per user
  const rateLimitResponse = await checkRateLimit(req, 10, `upload-blob:${userId}`);
  if (rateLimitResponse) return rateLimitResponse;

  const raw = await req.json().catch(() => null);
  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { base64, mimeType, filename } = parsed.data;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }

  // Strip path separators and validate safe filename
  const rawFilename = (filename ?? `share-${Date.now()}.png`).replace(/[/\\]/g, '').slice(0, 128);
  if (!SAFE_FILENAME_RE.test(rawFilename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const result = await uploadImageToBlob(base64, mimeType, rawFilename);
    return NextResponse.json({ url: result.url });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
