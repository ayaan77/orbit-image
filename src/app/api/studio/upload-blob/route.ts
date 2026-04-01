import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware/auth';
import { uploadImageToBlob } from '@/lib/mcp/blob';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.type === 'error') {
    return NextResponse.json({ error: auth.message }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.base64 || !body.mimeType) {
    return NextResponse.json({ error: 'Missing base64 or mimeType' }, { status: 400 });
  }

  const { base64, mimeType, filename } = body as {
    base64: string;
    mimeType: string;
    filename?: string;
  };

  try {
    const result = await uploadImageToBlob(
      base64,
      mimeType,
      filename ?? `share-${Date.now()}.png`
    );
    return NextResponse.json({ url: result.url });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
