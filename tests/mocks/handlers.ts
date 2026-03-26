import { http, HttpResponse } from "msw";
import {
  mockColours,
  mockBrandVoice,
  mockCompany,
  mockBrands,
  mockProof,
  wrapMcpResponse,
} from "./cortex-responses";

const CORTEX_URL = "https://cortex.test.apexure.com/api/mcp";

/** Map of Cortex tool names to their mock responses */
const toolResponses: Record<string, unknown> = {
  "brain_get-colours": mockColours,
  "brain_get-brand-voice": mockBrandVoice,
  "brain_get-company": mockCompany,
  "brain_list-brands": mockBrands,
  "brain_get-proof": mockProof,
  "brain_get-personas": [],
  "brain_get-audiences": [],
};

export const handlers = [
  http.post(CORTEX_URL, async ({ request }) => {
    const url = new URL(request.url);
    const brand = url.searchParams.get("brand");

    const body = (await request.json()) as {
      method: string;
      params: { name: string; arguments?: Record<string, unknown> };
    };

    const toolName = body.params?.name;

    if (!toolName || !(toolName in toolResponses)) {
      return HttpResponse.json(
        {
          jsonrpc: "2.0",
          id: "err",
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        },
        { status: 200 }
      );
    }

    // Simulate different brand returning empty data
    if (brand === "unknown-brand") {
      return HttpResponse.json(
        {
          jsonrpc: "2.0",
          id: "err",
          error: { code: -32000, message: "Brand not found" },
        },
        { status: 200 }
      );
    }

    return HttpResponse.json(wrapMcpResponse(toolResponses[toolName]));
  }),
];
