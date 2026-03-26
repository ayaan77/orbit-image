import { z } from "zod";
import { ImagePurpose, ImageStyle, DimensionsSchema } from "./api";

// ─── JSON-RPC 2.0 Incoming Request ───

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string().min(1),
  params: z.record(z.unknown()).default({}),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

// ─── JSON-RPC 2.0 Responses ───

export interface JsonRpcSuccessResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

export interface JsonRpcErrorResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
  };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

// ─── MCP Tool Definition ───

export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

// ─── generate-image Tool Params ───

export const GenerateImageParamsSchema = z.object({
  topic: z.string().min(1).max(500),
  purpose: ImagePurpose,
  brand: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  audience: z.string().min(1).max(200).optional(),
  persona: z.string().min(1).max(200).optional(),
  industry: z.string().min(1).max(200).optional(),
  style: ImageStyle.optional(),
  dimensions: DimensionsSchema.optional(),
  count: z.number().int().min(1).max(4).default(1),
  quality: z.enum(["standard", "hd"]).default("hd"),
  output_format: z.enum(["url", "base64"]).default("url"),
});
export type GenerateImageParams = z.infer<typeof GenerateImageParamsSchema>;
