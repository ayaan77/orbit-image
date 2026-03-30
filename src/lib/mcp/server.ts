import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MODEL_CATALOG, MODEL_IDS, type ModelId } from "@/lib/providers/models";
import { getEnv } from "@/lib/config/env";
import {
  handleListStyles,
  handleListPurposes,
  handleGenerateImage,
  handleListBrands,
  handleGetImage,
  type GenerateImageMeta,
} from "./handlers";

// ─── Zod schemas for MCP tool parameters ───

const GenerateImageInputSchema = {
  topic: z.string().min(1).max(500).describe("What the image should depict"),
  purpose: z
    .enum(["blog-hero", "social-og", "ad-creative", "case-study", "icon", "infographic"])
    .describe("Image purpose — determines default dimensions and prompt template"),
  brand: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .describe("Brand slug from Cortex (e.g. 'apexure'). Defaults to server's DEFAULT_BRAND."),
  audience: z.string().max(200).optional().describe("Target audience override"),
  persona: z.string().max(200).optional().describe("Brand persona override"),
  industry: z.string().max(200).optional().describe("Industry context override"),
  style: z
    .enum(["photographic", "illustration", "3d-render", "flat-design", "abstract", "minimalist"])
    .optional()
    .describe("Visual style override"),
  model: z
    .enum(MODEL_IDS as [string, ...string[]])
    .optional()
    .describe("Model to use. See list-models for available options."),
  dimensions: z
    .object({
      width: z.number().int().min(1).max(4096),
      height: z.number().int().min(1).max(4096),
    })
    .optional()
    .describe("Custom dimensions (overrides purpose default)"),
  count: z.number().int().min(1).max(4).default(1).describe("Number of images (1-4)"),
  quality: z.enum(["standard", "hd"]).default("hd").describe("Image quality"),
  output_format: z
    .enum(["url", "base64"])
    .default("url")
    .describe("Return format: 'url' uploads to Vercel Blob; 'base64' returns inline data"),
};

const GetImageInputSchema = {
  job_id: z.string().describe("The job ID returned from generate-image"),
};

// ─── Server factory ───

export interface McpRequestContext {
  readonly clientId: string;
  readonly clientName: string;
  readonly rateLimit?: number;
  readonly onUsage?: (meta: GenerateImageMeta) => void;
}

/**
 * Create a configured McpServer instance with all Orbit Image tools registered.
 * A new server is created per request in stateless mode.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "orbit-image",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ─── generate-image (auth required) ───
  server.registerTool(
    "generate-image",
    {
      title: "Generate Image",
      description:
        "Generate brand-consistent images using AI. Fetches brand data from Cortex, assembles an optimized prompt, and returns images via URL or base64.",
      inputSchema: GenerateImageInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      const ctx = extra.authInfo as (McpRequestContext & { scopes?: string[] }) | undefined;

      // Enforce brand-scope restrictions (same as legacy endpoint)
      const toolArgs = args as Record<string, unknown>;
      const brand = typeof toolArgs.brand === "string" ? toolArgs.brand : getEnv().DEFAULT_BRAND;
      if (ctx?.scopes?.length && !ctx.scopes.includes(brand)) {
        return {
          content: [{ type: "text", text: `Your API key does not have access to brand "${brand}".` }],
          isError: true,
        };
      }

      const result = await handleGenerateImage(
        "sdk",
        toolArgs,
        ctx?.onUsage,
      );

      if ("error" in result) {
        return {
          content: [{ type: "text", text: result.error.message }],
          isError: true,
        };
      }

      const resultContent = result.result as { content: Array<{ type: string; text: string }> };
      return {
        content: resultContent.content.map((c: { type: string; text: string }) => ({
          type: "text" as const,
          text: c.text,
        })),
      };
    },
  );

  // ─── get-image (auth required) ───
  server.registerTool(
    "get-image",
    {
      title: "Get Image",
      description:
        "Retrieve a previously generated image by job ID. Returns the job status and image data if completed.",
      inputSchema: GetImageInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args, extra) => {
      const ctx = extra.authInfo as McpRequestContext | undefined;
      const clientId = ctx?.clientId ?? "master";

      const result = await handleGetImage("sdk", args as Record<string, unknown>, clientId);

      if ("error" in result) {
        return {
          content: [{ type: "text", text: result.error.message }],
          isError: true,
        };
      }

      const resultContent = result.result as { content: Array<{ type: string; text: string }> };
      return {
        content: resultContent.content.map((c: { type: string; text: string }) => ({
          type: "text" as const,
          text: c.text,
        })),
      };
    },
  );

  // ─── list-styles (no auth) ───
  server.registerTool(
    "list-styles",
    {
      title: "List Styles",
      description: "List all available image styles (photographic, illustration, 3d-render, etc.)",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      const result = handleListStyles("sdk");
      const resultContent = result.result as { content: Array<{ type: string; text: string }> };
      return {
        content: resultContent.content.map((c: { type: string; text: string }) => ({
          type: "text" as const,
          text: c.text,
        })),
      };
    },
  );

  // ─── list-purposes (no auth) ───
  server.registerTool(
    "list-purposes",
    {
      title: "List Purposes",
      description:
        "List all available image purposes with their default dimensions (blog-hero, social-og, ad-creative, etc.)",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      const result = handleListPurposes("sdk");
      const resultContent = result.result as { content: Array<{ type: string; text: string }> };
      return {
        content: resultContent.content.map((c: { type: string; text: string }) => ({
          type: "text" as const,
          text: c.text,
        })),
      };
    },
  );

  // ─── list-brands (no auth) ───
  server.registerTool(
    "list-brands",
    {
      title: "List Brands",
      description: "List available brands from Cortex with their active status.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async () => {
      const result = await handleListBrands("sdk");

      if ("error" in result) {
        return {
          content: [{ type: "text", text: result.error.message }],
          isError: true,
        };
      }

      const resultContent = result.result as { content: Array<{ type: string; text: string }> };
      return {
        content: resultContent.content.map((c: { type: string; text: string }) => ({
          type: "text" as const,
          text: c.text,
        })),
      };
    },
  );

  // ─── list-models (no auth) ───
  server.registerTool(
    "list-models",
    {
      title: "List Models",
      description:
        "List all available image generation models with their provider, tier, and required configuration.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      const models = MODEL_IDS.map((id) => {
        const entry = MODEL_CATALOG[id as ModelId];
        const envSet = !!process.env[entry.requiresEnv];
        return {
          id,
          displayName: entry.displayName,
          provider: entry.provider,
          badge: entry.badge,
          tier: entry.tier,
          available: envSet,
        };
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ models }) }],
      };
    },
  );

  return server;
}
