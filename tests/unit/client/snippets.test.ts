import { describe, it, expect } from "vitest";
import {
  getClaudeDesktopConfig,
  getCursorConfig,
  getClaudeCodeConfig,
  getGenericMcpConfig,
  getSyncSnippet,
  getMcpSnippet,
} from "@/lib/client/snippets";

describe("MCP config snippets", () => {
  const baseUrl = "https://orbit.example.com";
  const token = "oimg_live_abc123";

  describe("getClaudeDesktopConfig", () => {
    it("returns valid JSON with mcpServers key", () => {
      const config = getClaudeDesktopConfig(baseUrl, token);
      const parsed = JSON.parse(config);
      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers["orbit-image"]).toBeDefined();
    });

    it("uses Authorization header, not URL token", () => {
      const config = getClaudeDesktopConfig(baseUrl, token);
      expect(config).not.toContain("?token=");
      expect(config).toContain("Authorization");
      expect(config).toContain(`Bearer ${token}`);
    });

    it("points to /api/mcp endpoint", () => {
      const config = getClaudeDesktopConfig(baseUrl, token);
      const parsed = JSON.parse(config);
      expect(parsed.mcpServers["orbit-image"].url).toBe(`${baseUrl}/api/mcp`);
    });
  });

  describe("getCursorConfig", () => {
    it("returns valid JSON with headers", () => {
      const config = getCursorConfig(baseUrl, token);
      const parsed = JSON.parse(config);
      expect(parsed.mcpServers["orbit-image"].headers.Authorization).toBe(`Bearer ${token}`);
    });

    it("does not include token in URL", () => {
      const config = getCursorConfig(baseUrl, token);
      expect(config).not.toContain("?token=");
    });
  });

  describe("getClaudeCodeConfig", () => {
    it("returns .mcp.json format with type: http", () => {
      const config = getClaudeCodeConfig(baseUrl, token);
      const parsed = JSON.parse(config);
      expect(parsed["orbit-image"].type).toBe("http");
      expect(parsed["orbit-image"].url).toBe(`${baseUrl}/api/mcp`);
      expect(parsed["orbit-image"].headers.Authorization).toBe(`Bearer ${token}`);
    });
  });

  describe("getGenericMcpConfig", () => {
    it("includes URL and Bearer token", () => {
      const config = getGenericMcpConfig(baseUrl, token);
      expect(config).toContain(`${baseUrl}/api/mcp`);
      expect(config).toContain(`Bearer ${token}`);
    });

    it("does not include token-in-URL pattern", () => {
      const config = getGenericMcpConfig(baseUrl, token);
      expect(config).not.toContain("?token=");
    });
  });
});

describe("getSyncSnippet", () => {
  const opts = { baseUrl: "https://api.example.com", apiKey: "test-key" };

  it("curl snippet includes Authorization header", () => {
    const snippet = getSyncSnippet("curl", opts);
    expect(snippet).toContain("Authorization: Bearer test-key");
    expect(snippet).toContain("/api/generate");
  });

  it("javascript snippet includes fetch with headers", () => {
    const snippet = getSyncSnippet("javascript", opts);
    expect(snippet).toContain("Bearer test-key");
    expect(snippet).toContain("api/generate");
  });

  it("python snippet includes requests.post", () => {
    const snippet = getSyncSnippet("python", opts);
    expect(snippet).toContain("Bearer test-key");
    expect(snippet).toContain("requests.post");
  });

  it("uses default brand and purpose when not specified", () => {
    const snippet = getSyncSnippet("curl", opts);
    expect(snippet).toContain("apexure");
    expect(snippet).toContain("blog-hero");
  });
});

describe("getMcpSnippet", () => {
  it("includes MCP server config block", () => {
    const snippet = getMcpSnippet({ baseUrl: "https://test.com", apiKey: "key123" });
    expect(snippet).toContain("mcpServers");
    expect(snippet).toContain("orbit-image");
    expect(snippet).toContain("key123");
  });
});
