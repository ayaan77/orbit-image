export interface ClientInfo {
  readonly clientId: string;
  readonly clientName: string;
  readonly createdAt: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly defaultWebhookUrl?: string;
}

export type AuthResult =
  | { readonly type: "master" }
  | { readonly type: "client"; readonly client: ClientInfo }
  | { readonly type: "error"; readonly code: string; readonly message: string };
