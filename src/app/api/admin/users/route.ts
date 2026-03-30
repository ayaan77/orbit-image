import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { corsHeaders } from "@/lib/middleware/cors";
import { createUser, listUsers, updateUser, deleteUser } from "@/lib/auth/users";

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(["admin", "user"]).optional(),
  rateLimit: z.number().int().positive().nullable().optional(),
  monthlyBudgetUsd: z.number().positive().nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const result = await listUsers(limit, offset);
    return NextResponse.json({ success: true, ...result }, { headers });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list users" } },
      { status: 500, headers },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  try {
    const body = await request.json();
    const { username, password, role, email, rateLimit, monthlyBudgetUsd } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "Username and password are required" } },
        { status: 400, headers },
      );
    }

    const user = await createUser(username, password, role || "user", {
      email,
      rateLimit,
      monthlyBudgetUsd,
    });

    return NextResponse.json({ success: true, user }, { status: 201, headers });
  } catch (err) {
    const message = err instanceof Error && err.message.includes("unique")
      ? "Username already exists"
      : "Failed to create user";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: message.includes("exists") ? 409 : 500, headers },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  try {
    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: issues } },
        { status: 400, headers },
      );
    }

    const { userId, ...updates } = parsed.data;
    const user = await updateUser(userId, updates);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ success: true, user }, { headers });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update user" } },
      { status: 500, headers },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "userId is required" } },
        { status: 400, headers },
      );
    }

    const deleted = await deleteUser(userId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ success: true, message: "User deleted" }, { headers });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete user" } },
      { status: 500, headers },
    );
  }
}
