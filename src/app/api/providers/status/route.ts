import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { DEFAULT_MODEL, MODEL_CATALOG, type ModelId } from "@/lib/providers/models";

export const runtime = "nodejs";

/**
 * GET /api/providers/status
 * Returns which providers are configured (env var present, not the value).
 * Requires bearer auth (client or master) — not admin-only.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);

  if (auth.type === "error") {
    return NextResponse.json(
      { success: false, error: { code: auth.code, message: auth.message } },
      { status: 401 }
    );
  }

  const providers = {
    openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    replicate: { configured: Boolean(process.env.REPLICATE_API_TOKEN) },
    xai: { configured: Boolean(process.env.XAI_API_KEY) },
  } as const;

  // Build list of available model IDs (provider is configured)
  const availableModels = (Object.keys(MODEL_CATALOG) as ModelId[]).filter(
    (id) => providers[MODEL_CATALOG[id].provider].configured
  );

  return NextResponse.json({
    success: true,
    providers,
    defaultModel: DEFAULT_MODEL,
    availableModels,
  });
}
