import type { ZodSchema } from "zod";
import type { ErrorResponse } from "@/types/api";
import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 32 * 1024; // 32 KB

export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse<ErrorResponse> }
> {
  // Check content length before parsing
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (contentLength > MAX_BODY_BYTES) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false as const,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body too large",
          },
        },
        { status: 413 }
      ),
    };
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false as const,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid JSON in request body",
          },
        },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false as const,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details,
          },
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
