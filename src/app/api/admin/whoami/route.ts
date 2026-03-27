import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limited = await checkRateLimit(request, 5);
  if (limited) return limited;

  const admin = await isMasterKey(request);
  if (!admin) return unauthorizedResponse();
  return NextResponse.json({ admin: true });
}
