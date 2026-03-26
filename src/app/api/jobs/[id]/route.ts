import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { authResultToResponse } from "@/lib/middleware/auth-helpers";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { getJob } from "@/lib/jobs/store";
import type { ErrorResponse } from "@/types/api";

interface JobResponse {
  readonly success: true;
  readonly job: {
    readonly id: string;
    readonly status: string;
    readonly createdAt: string;
    readonly completedAt?: string;
    readonly result?: unknown;
    readonly error?: string;
  };
}

/** CORS preflight */
export function OPTIONS(request: Request) {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<JobResponse | ErrorResponse>> {
  const requestId = getRequestId(request);
  const headers = { ...requestIdHeaders(requestId), ...corsHeaders(request) };

  // Auth
  const authResult = await authenticateRequest(request);
  const authError = authResultToResponse(authResult);
  if (authError) {
    Object.entries(headers).forEach(([k, v]) => authError.headers.set(k, v));
    return authError;
  }

  const { id } = await params;

  // Validate job ID format
  if (!id.startsWith("job_") || id.length < 10) {
    return NextResponse.json(
      {
        success: false as const,
        error: { code: "INVALID_JOB_ID", message: "Invalid job ID format." },
      },
      { status: 400, headers },
    );
  }

  const job = await getJob(id);

  if (!job) {
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "JOB_NOT_FOUND",
          message: "Job not found or expired. Jobs expire after 24 hours.",
        },
      },
      { status: 404, headers },
    );
  }

  // Verify ownership: client can only see their own jobs
  const clientId =
    authResult.type === "client" ? authResult.client.clientId : "master";
  if (job.clientId !== clientId && authResult.type !== "master") {
    return NextResponse.json(
      {
        success: false as const,
        error: { code: "JOB_NOT_FOUND", message: "Job not found." },
      },
      { status: 404, headers },
    );
  }

  return NextResponse.json(
    {
      success: true as const,
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: job.status === "completed" ? job.result : undefined,
        error: job.status === "failed" ? job.error : undefined,
      },
    },
    { headers },
  );
}
