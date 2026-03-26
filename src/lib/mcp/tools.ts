import type { McpToolDefinition } from "@/types/mcp";

// ─── Tool Definitions ───

const GENERATE_IMAGE_TOOL: McpToolDefinition = {
  name: "generate-image",
  description:
    "Generate brand-consistent images using AI. Fetches brand data from Cortex, assembles an optimized prompt, and returns images via URL or base64.",
  inputSchema: {
    type: "object",
    required: ["topic", "purpose"],
    properties: {
      topic: {
        type: "string",
        description: "What the image should depict (1-500 chars)",
        minLength: 1,
        maxLength: 500,
      },
      purpose: {
        type: "string",
        description: "Image purpose — determines default dimensions and prompt template",
        enum: [
          "blog-hero",
          "social-og",
          "ad-creative",
          "case-study",
          "icon",
          "infographic",
        ],
      },
      brand: {
        type: "string",
        description:
          "Brand slug from Cortex (e.g. 'apexure'). Defaults to server's DEFAULT_BRAND.",
        pattern: "^[a-z0-9-]+$",
      },
      audience: {
        type: "string",
        description: "Target audience override (e.g. 'SaaS founders')",
        maxLength: 200,
      },
      persona: {
        type: "string",
        description: "Brand persona override (e.g. 'friendly expert')",
        maxLength: 200,
      },
      industry: {
        type: "string",
        description: "Industry context override (e.g. 'fintech')",
        maxLength: 200,
      },
      style: {
        type: "string",
        description: "Visual style override",
        enum: [
          "photographic",
          "illustration",
          "3d-render",
          "flat-design",
          "abstract",
          "minimalist",
        ],
      },
      dimensions: {
        type: "object",
        description: "Custom dimensions (overrides purpose default)",
        properties: {
          width: { type: "integer", minimum: 1, maximum: 4096 },
          height: { type: "integer", minimum: 1, maximum: 4096 },
        },
        required: ["width", "height"],
      },
      count: {
        type: "integer",
        description: "Number of images to generate (1-4)",
        minimum: 1,
        maximum: 4,
        default: 1,
      },
      quality: {
        type: "string",
        description: "Image quality",
        enum: ["standard", "hd"],
        default: "hd",
      },
      output_format: {
        type: "string",
        description:
          "Return format: 'url' uploads to Vercel Blob and returns a signed URL; 'base64' returns inline data",
        enum: ["url", "base64"],
        default: "url",
      },
    },
  },
};

const LIST_STYLES_TOOL: McpToolDefinition = {
  name: "list-styles",
  description: "List all available image styles (photographic, illustration, 3d-render, etc.)",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const LIST_PURPOSES_TOOL: McpToolDefinition = {
  name: "list-purposes",
  description:
    "List all available image purposes with their default dimensions (blog-hero, social-og, ad-creative, etc.)",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

// ─── Registry ───

const TOOL_REGISTRY: readonly McpToolDefinition[] = [
  GENERATE_IMAGE_TOOL,
  LIST_STYLES_TOOL,
  LIST_PURPOSES_TOOL,
] as const;

const AUTH_REQUIRED_TOOLS = new Set(["generate-image"]);

export function getToolDefinitions(): readonly McpToolDefinition[] {
  return TOOL_REGISTRY;
}

export function findTool(name: string): McpToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function isAuthRequired(toolName: string): boolean {
  return AUTH_REQUIRED_TOOLS.has(toolName);
}
