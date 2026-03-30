export interface ClientInfo {
  readonly clientId: string;
  readonly clientName: string;
  readonly createdAt: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly defaultWebhookUrl?: string;
  readonly monthlyBudgetUsd?: number;
  readonly email?: string;
  readonly source?: "admin" | "studio";
}

export interface User {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
  readonly role: "admin" | "user";
  readonly rateLimit?: number;
  readonly monthlyBudgetUsd?: number;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface McpToken {
  readonly id: string;
  readonly name: string;
  readonly createdBy: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly defaultWebhookUrl?: string;
  readonly monthlyBudgetUsd?: number;
  readonly createdAt: string;
}

export type AuthResult =
  | { readonly type: "master" }
  | { readonly type: "user"; readonly user: User }
  | { readonly type: "client"; readonly client: ClientInfo }
  | { readonly type: "error"; readonly code: string; readonly message: string };
