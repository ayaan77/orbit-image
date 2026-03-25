import { randomUUID } from "crypto";
import type {
  BrandColours,
  BrandContext,
  BrandInfo,
  BrandVoice,
  CompanyData,
  Persona,
  Audience,
  ProofData,
} from "./types";
import { getEnv } from "@/lib/config/env";

export class CortexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CortexError";
  }
}

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string;
  readonly method: string;
  readonly params: {
    readonly name: string;
    readonly arguments?: Record<string, unknown>;
  };
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string;
  readonly result?: {
    readonly content: readonly { readonly type: string; readonly text: string }[];
  };
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

const FETCH_TIMEOUT_MS = 10_000;

function buildUrl(brand: string): string {
  const { CORTEX_BASE_URL } = getEnv();
  return `${CORTEX_BASE_URL}?brand=${encodeURIComponent(brand)}`;
}

async function callTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  brand: string
): Promise<T> {
  const url = buildUrl(brand);
  const body: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: randomUUID(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new CortexError(
      `Cortex request failed: ${response.status}`
    );
  }

  const json = (await response.json()) as JsonRpcResponse;

  if (json.error) {
    throw new CortexError(
      `Cortex tool error [${json.error.code}]: ${json.error.message}`
    );
  }

  if (!json.result?.content?.[0]?.text) {
    throw new CortexError(`Cortex returned empty result for tool: ${toolName}`);
  }

  try {
    return JSON.parse(json.result.content[0].text) as T;
  } catch {
    throw new CortexError(
      `Cortex returned invalid JSON for tool: ${toolName}`
    );
  }
}

export function createCortexClient(defaultBrand?: string) {
  const brand = defaultBrand ?? getEnv().DEFAULT_BRAND;

  return {
    async getColours(overrideBrand?: string): Promise<BrandColours> {
      return callTool<BrandColours>("get-colours", {}, overrideBrand ?? brand);
    },

    async getBrandVoice(overrideBrand?: string): Promise<BrandVoice> {
      return callTool<BrandVoice>("get-brand-voice", {}, overrideBrand ?? brand);
    },

    async getCompany(overrideBrand?: string): Promise<CompanyData> {
      return callTool<CompanyData>("get-company", {}, overrideBrand ?? brand);
    },

    async getPersonas(overrideBrand?: string, id?: string): Promise<Persona[]> {
      const args = id ? { id } : {};
      return callTool<Persona[]>("get-personas", args, overrideBrand ?? brand);
    },

    async getAudiences(overrideBrand?: string, id?: string): Promise<Audience[]> {
      const args = id ? { id } : {};
      return callTool<Audience[]>("get-audiences", args, overrideBrand ?? brand);
    },

    async getProof(
      overrideBrand?: string,
      opts?: { topic?: string; industry?: string; persona?: string; limit?: number }
    ): Promise<ProofData> {
      const args: Record<string, unknown> = {
        ...(opts?.topic && { topic: opts.topic }),
        ...(opts?.industry && { industry: opts.industry }),
        ...(opts?.persona && { persona: opts.persona }),
        ...(opts?.limit && { limit: opts.limit }),
      };
      return callTool<ProofData>("get-proof", args, overrideBrand ?? brand);
    },

    async listBrands(): Promise<BrandInfo[]> {
      return callTool<BrandInfo[]>("list-brands", {}, brand);
    },
  };
}

export type CortexClient = ReturnType<typeof createCortexClient>;
