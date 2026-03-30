import { describe, it, expect } from "vitest";
import {
  getToolDefinitions,
  findTool,
  isAuthRequired,
} from "@/lib/mcp/tools";

describe("getToolDefinitions", () => {
  it("returns exactly 5 tools", () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(5);
  });

  it("includes all registered tools", () => {
    const names = getToolDefinitions().map((t) => t.name);
    expect(names).toEqual([
      "generate-image",
      "list-styles",
      "list-purposes",
      "list-brands",
      "get-image",
    ]);
  });

  it("each tool has name, description, and inputSchema", () => {
    for (const tool of getToolDefinitions()) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("generate-image has required fields topic and purpose", () => {
    const tool = getToolDefinitions().find((t) => t.name === "generate-image");
    expect(tool?.inputSchema.required).toEqual(["topic", "purpose"]);
  });

  it("generate-image lists output_format with url and base64", () => {
    const tool = getToolDefinitions().find((t) => t.name === "generate-image");
    const props = tool?.inputSchema.properties as Record<string, { enum?: string[] }>;
    expect(props.output_format.enum).toEqual(["url", "base64"]);
  });
});

describe("findTool", () => {
  it("returns the tool definition for a known tool", () => {
    const tool = findTool("list-styles");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("list-styles");
  });

  it("returns undefined for an unknown tool", () => {
    expect(findTool("nonexistent")).toBeUndefined();
  });
});

describe("isAuthRequired", () => {
  it("returns true for generate-image", () => {
    expect(isAuthRequired("generate-image")).toBe(true);
  });

  it("returns false for list-styles", () => {
    expect(isAuthRequired("list-styles")).toBe(false);
  });

  it("returns false for list-purposes", () => {
    expect(isAuthRequired("list-purposes")).toBe(false);
  });

  it("returns false for unknown tools", () => {
    expect(isAuthRequired("unknown")).toBe(false);
  });
});
