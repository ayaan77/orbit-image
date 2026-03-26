import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/setup";
import { createCortexClient, CortexError } from "@/lib/cortex/client";
import {
  mockColours,
  mockBrandVoice,
  mockCompany,
  mockBrands,
  mockProof,
} from "../../mocks/cortex-responses";

const CORTEX_URL = "https://cortex.test.apexure.com/api/mcp";

describe("CortexClient", () => {
  const client = createCortexClient("apexure");

  describe("getColours", () => {
    it("returns parsed brand colours", async () => {
      const result = await client.getColours();
      expect(result).toEqual(mockColours);
      expect(result.primary.hex).toBe("#410099");
    });

    it("supports brand override", async () => {
      // "unknown-brand" returns an error in our mock handlers
      await expect(client.getColours("unknown-brand")).rejects.toThrow(
        CortexError
      );
    });
  });

  describe("getBrandVoice", () => {
    it("returns parsed brand voice", async () => {
      const result = await client.getBrandVoice();
      expect(result).toEqual(mockBrandVoice);
      expect(result.brand_voice_rules.tone_spectrum).toBe(
        "professional-casual"
      );
    });
  });

  describe("getCompany", () => {
    it("returns parsed company data", async () => {
      const result = await client.getCompany();
      expect(result).toEqual(mockCompany);
      expect(result.brand_config.id).toBe("apexure");
    });
  });

  describe("listBrands", () => {
    it("returns list of brands", async () => {
      const result = await client.listBrands();
      expect(result).toEqual(mockBrands);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("apexure");
    });
  });

  describe("getProof", () => {
    it("returns proof data", async () => {
      const result = await client.getProof();
      expect(result).toEqual(mockProof);
      expect(result.case_studies).toHaveLength(1);
    });
  });

  describe("getPersonas", () => {
    it("returns empty array for personas", async () => {
      const result = await client.getPersonas();
      expect(result).toEqual([]);
    });
  });

  describe("getAudiences", () => {
    it("returns empty array for audiences", async () => {
      const result = await client.getAudiences();
      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("throws CortexError on HTTP failure", async () => {
      server.use(
        http.post(CORTEX_URL, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(client.getColours()).rejects.toThrow(CortexError);
      await expect(client.getColours()).rejects.toThrow(
        "Cortex request failed: 500"
      );
    });

    it("throws CortexError on JSON-RPC error response", async () => {
      server.use(
        http.post(CORTEX_URL, () => {
          return HttpResponse.json({
            jsonrpc: "2.0",
            id: "err",
            error: { code: -32601, message: "Tool not found" },
          });
        })
      );

      await expect(client.getColours()).rejects.toThrow(CortexError);
      await expect(client.getColours()).rejects.toThrow("Tool not found");
    });

    it("throws CortexError on empty result", async () => {
      server.use(
        http.post(CORTEX_URL, () => {
          return HttpResponse.json({
            jsonrpc: "2.0",
            id: "empty",
            result: { content: [] },
          });
        })
      );

      await expect(client.getColours()).rejects.toThrow(CortexError);
      await expect(client.getColours()).rejects.toThrow("empty result");
    });

    it("throws CortexError on invalid JSON in result", async () => {
      server.use(
        http.post(CORTEX_URL, () => {
          return HttpResponse.json({
            jsonrpc: "2.0",
            id: "bad-json",
            result: {
              content: [{ type: "text", text: "not valid json{{{" }],
            },
          });
        })
      );

      await expect(client.getColours()).rejects.toThrow(CortexError);
      await expect(client.getColours()).rejects.toThrow("invalid JSON");
    });

    it("throws CortexError for unknown tool name", async () => {
      await expect(client.getColours("unknown-brand")).rejects.toThrow(
        CortexError
      );
    });
  });
});
