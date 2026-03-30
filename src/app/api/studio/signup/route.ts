import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createUser, getUserByUsername } from "@/lib/auth/users";
import { createMcpToken } from "@/lib/auth/mcp-tokens";
import { createSession, buildSessionCookie } from "@/lib/auth/sessions";
import { createApiKey } from "@/lib/auth/keys";
import { getDb } from "@/lib/storage/db";

const SignupSchema = z.object({
  email: z.string().email("Valid email required"),
  companyName: z.string().min(1, "Company name required").max(100),
});

/**
 * POST /api/studio/signup
 * Self-serve signup. Creates a user account + MCP token.
 * Falls back to legacy Redis key if Postgres is not configured.
 * Rate-limited: 1 signup per IP per hour.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cors = corsHeaders(request);

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

  // Derive username from email (before @)
  const baseUsername = email.split("@")[0].replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "user";

  try {
    const db = getDb();

    // ─── Postgres path: create user + session + MCP token ───
    if (db) {
      // Check if username exists, append random suffix if so
      let username = baseUsername;
      const existing = await getUserByUsername(username);
      if (existing) {
        username = `${baseUsername}-${Math.random().toString(36).slice(2, 6)}`;
      }

      // Generate a random password (user can reset later or use session)
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      const user = await createUser(username, password, "user", {
        email,
        rateLimit: 10,
        monthlyBudgetUsd: 1.0,
      });

      // Create an MCP token for the user
      const { rawKey, token } = await createMcpToken(
        `${companyName} token`,
        user.id,
        { rateLimit: 10, monthlyBudgetUsd: 1.0 },
      );

      // Create session so user is logged in immediately
      const sessionId = await createSession(user.id);
      const cookie = buildSessionCookie(sessionId);

      return NextResponse.json(
        {
          success: true,
          apiKey: rawKey,
          clientId: token.id,
          username,
          limits: {
            rateLimit: 10,
            monthlyBudgetUsd: 1.0,
          },
        },
        {
          status: 201,
          headers: { ...cors, "Set-Cookie": cookie },
        },
      );
    }

    // ─── Fallback: legacy Redis key (no Postgres) ───
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
