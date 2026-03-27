import type { GenerateRequest } from "@/types/api";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobImage {
  readonly base64?: string;
  readonly url?: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface JobResult {
  readonly images: readonly JobImage[];
  readonly brand: string;
  readonly processingTimeMs: number;
  readonly cortexDataCached: boolean;
  readonly resultCached?: boolean;
}

export interface Job {
  readonly id: string;
  readonly status: JobStatus;
  readonly clientId: string;
  readonly request: GenerateRequest;
  readonly result?: JobResult;
  readonly error?: string;
  readonly webhookUrl?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export interface JobCreateInput {
  readonly clientId: string;
  readonly request: GenerateRequest;
  readonly webhookUrl?: string;
}
