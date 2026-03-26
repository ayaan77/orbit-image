export interface UsageEntry {
  readonly clientId: string;
  readonly clientName: string;
  readonly brand: string;
  readonly purpose: string;
  readonly style?: string;
  readonly imageCount: number;
  readonly quality: string;
  readonly estimatedCostUsd: number;
  readonly processingTimeMs: number;
  readonly cached: boolean;
  readonly endpoint: "rest" | "mcp";
  readonly timestamp: Date;
}
