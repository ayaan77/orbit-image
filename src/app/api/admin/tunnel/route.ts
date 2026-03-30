import { NextResponse } from "next/server";
import { isAdmin, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import {
  getTunnelState,
  startTunnel,
  stopTunnel,
  isCloudflaredInstalled,
} from "@/lib/tunnel/manager";

export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const tunnel = getTunnelState();
  const installed = await isCloudflaredInstalled();

  return NextResponse.json(
    { success: true, tunnel, cloudflaredInstalled: installed },
    { headers },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PRODUCTION_NOT_SUPPORTED",
          message: "Tunnel is not available in production — your app is already publicly accessible",
        },
      },
      { status: 400, headers },
    );
  }

  let port = 3000;
  try {
    const body = await request.json();
    if (typeof body.port === "number" && body.port > 0 && body.port < 65536) {
      port = body.port;
    }
  } catch {
    // No body or invalid JSON — use default port
  }

  const tunnel = await startTunnel(port);

  if (tunnel.status === "error" && tunnel.error === "cloudflared is not installed") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CLOUDFLARED_NOT_FOUND",
          message: "cloudflared CLI is not installed. Install it with: brew install cloudflare/cloudflare/cloudflared",
        },
      },
      { status: 400, headers },
    );
  }

  if (tunnel.status === "error") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "TUNNEL_ERROR", message: tunnel.error ?? "Unknown tunnel error" },
      },
      { status: 500, headers },
    );
  }

  return NextResponse.json({ success: true, tunnel }, { headers });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const tunnel = stopTunnel();
  return NextResponse.json({ success: true, tunnel }, { headers });
}
