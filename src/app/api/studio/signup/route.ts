import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createApiKey } from "@/lib/auth/keys";

const SignupSchema = z.object({
  email: z.string().email("Valid email required"),
  companyName: z.string().min(1, "Company name required").max(100),
});

/**
 * POST /api/studio/signup
 * Self-serve API key provisioning. No auth required.
 * Rate-limited: 1 signup per IP per hour.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cors = corsHeaders(request);

  // IP-based rate limit: 1 signup per hour
  const rateLimited = checkIpRateLimit(request, 1, 3_600_000, "studio:signup");
  if (rateLimited) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "You can only sign up once per hour. Please try again later.",
        },
      },
      { status: 429, headers: cors },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers: cors },
    );
  }

  const parsed = SignupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request" } },
      { status: 400, headers: cors },
    );
  }

  const { email, companyName } = parsed.data;

  try {
    const { rawKey, client } = await createApiKey(companyName, {
      rateLimit: 10,
      monthlyBudgetUsd: 1.0,
      scopes: ["generate"],
      email,
      source: "studio",
    });

    return NextResponse.json(
      {
        success: true,
        apiKey: rawKey,
        clientId: client.clientId,
        limits: {
          rateLimit: 10,
          monthlyBudgetUsd: 1.0,
          scopes: ["generate"],
        },
      },
      { status: 201, headers: cors },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return NextResponse.json(
      { success: false, error: { code: "SIGNUP_ERROR", message } },
      { status: 503, headers: cors },
    );
  }
}

export function OPTIONS(request: Request): NextResponse {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}
