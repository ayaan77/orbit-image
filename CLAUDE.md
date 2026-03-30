# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js + Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm test             # Run all tests (vitest, watch mode)
npm test -- --run    # Run tests once (no watch)
npm test -- tests/unit/prompt/engine.test.ts  # Run a single test file
npm run test:coverage  # Tests with coverage (thresholds: 30% lines, 54% functions)
```

## Architecture

Orbit Image is a **brand-aware, multi-provider AI image generation service**. It pulls brand context from the Cortex MCP API, assembles tailored prompts, and generates images via multiple providers (OpenAI, Replicate, xAI). Exposes both a REST API and an MCP server (JSON-RPC 2.0 over HTTP).

### Request Flow

```
Client → POST /api/generate  OR  POST /api/mcp (JSON-RPC tools/call)
  → auth: session cookie | Bearer oimg_live_* token | master API_SECRET_KEY
  → rate limit (in-memory sliding window per client)
  → Zod validation
  → CachedCortexClient.getBrandContext() — parallel fetch of colours/voice/company/proof
  → PromptEngine.assemblePrompt() — brand context → PromptBundle
  → resolveModel() → provider.generate() — PromptBundle → images
  → Usage logging (Postgres) + cost estimation
  → JSON response with images + metadata
```

### Key Layers

- **`src/lib/cortex/`** — Cortex MCP client. JSON-RPC 2.0 over HTTP. `cached-client.ts` wraps raw client with in-memory TTL cache (configurable via `CACHE_TTL_SECONDS`).
- **`src/lib/prompt/`** — Prompt assembly. `engine.ts` orchestrates: `templates.ts` (purpose-specific templates), `color-mapper.ts` (brand colors → natural-language directives).
- **`src/lib/providers/`** — Multi-provider image generation behind `ImageProvider` interface. Providers: `openai.ts` (gpt-image-1, dall-e-3), `replicate.ts` (flux-pro/dev/schnell), `xai.ts` (grok-aurora), `mock.ts` (testing). `models.ts` defines the `MODEL_CATALOG` with tier/badge metadata. `factory.ts` has `resolveModel()` (preferred) and legacy `getProvider()`.
- **`src/lib/middleware/`** — Request pipeline: `auth.ts` (3-path auth: session → MCP token → master key), `rate-limit.ts` (sliding window), `ip-rate-limit.ts`, `cors.ts`, `request-id.ts`, `validation.ts` (Zod + body size), `admin-auth.ts` (admin role gate).
- **`src/lib/auth/`** — Auth system: `users.ts` (Postgres user CRUD), `sessions.ts` (cookie-based sessions), `mcp-tokens.ts` (per-user MCP tokens with scopes), `keys.ts` (legacy Redis API keys), `types.ts` (`AuthResult` discriminated union: master | user | client | error).
- **`src/lib/config/env.ts`** — Zod-validated env with caching. Call `resetEnvCache()` in tests.
- **`src/lib/usage/`** — Usage tracking: `logger.ts` (Postgres logging), `cost.ts` (per-image cost estimation).
- **`src/lib/storage/`** — `db.ts` (Neon Postgres via `@neondatabase/serverless`), `kv.ts` (Upstash Redis).
- **`src/lib/mcp/`** — MCP server tools: `tools.ts` (tool definitions + registry), `handlers.ts` (tool dispatch), `blob.ts` (Vercel Blob for URL output), `errors.ts` (JSON-RPC error codes).
- **`src/lib/queue/`** — `concurrency-queue.ts` (bounded concurrent generation).
- **`src/lib/cache/`** — `result-cache.ts` (image result caching).
- **`src/lib/jobs/`** — Async job system: `store.ts`, `processor.ts`, `webhook.ts`.
- **`src/lib/logging/logger.ts`** — Structured logger with log levels.

### Auth Model

Three auth paths checked in order:
1. **Session cookie** (`orbit-session`) → Postgres user lookup → `{ type: "user", user }` (web UI)
2. **Bearer token** (`oimg_live_*`) → Postgres MCP token or Redis legacy key → `{ type: "client", client }` (API/MCP)
3. **Master key** (`API_SECRET_KEY`) → timing-safe compare → `{ type: "master" }` (admin)

`AuthResult` is a discriminated union — always check `.type` before accessing fields.

### API Routes

- `POST /api/generate` — REST image generation (60s max on Vercel)
- `POST /api/mcp` — MCP server endpoint (JSON-RPC 2.0). Tools: `generate-image`, `list-styles`, `list-purposes`, `list-brands`, `get-image`. Supports `?token=` query param.
- `GET /api/brands` — List brands from Cortex
- `GET /api/health` — Health check
- `POST /api/studio/generate` — Studio-specific generation
- `POST /api/studio/preview` — Prompt preview without generation
- `GET /api/providers/status` — Provider availability check
- `/api/admin/*` — Admin endpoints (users, tokens, keys, usage, config, cache, webhook-logs, services)
- `/api/auth/*` — Auth endpoints (login, logout, me, signup)
- `/api/jobs/[id]` — Job status polling

### Frontend

- **Main page** (`src/app/page.tsx`) — Dashboard with `AuthProvider` context. Shows `LoginForm` when unauthenticated, `Dashboard` when authenticated.
- **Studio** (`src/app/studio/page.tsx`) — Full image generation UI with model selection, brand picker, compare view.
- **Admin** (`src/app/admin/`) — Admin panel with user management, token management, usage stats.
- **Components** — CSS Modules throughout. Key components: `Dashboard`, `Playground`, `GeneratorForm`, `ModelSelector`, `BrandPicker`, `CompareView`, `HistoryDrawer`, `ConnectWizard`, `AppsPanel`, `UsagePanel`, `QuickStart`, `SettingsModal`, `Header`.
- **Client utilities** (`src/lib/client/`) — `api.ts` (fetch wrapper), `useProviderStatus.ts` (provider health hook), `snippets.ts` (code snippet generation), `storage.ts` (localStorage helpers).

## Testing

- **Framework**: Vitest with MSW for HTTP mocking
- **Setup files**: `tests/mocks/setup.ts` (env stubs + MSW server), `tests/mocks/setup-dom.ts` (DOM environment)
- **Mock data**: `tests/mocks/cortex-responses.ts` (fixtures), `tests/mocks/handlers.ts` (MSW handlers)
- **Path alias**: `@/` maps to `./src/` (in both tsconfig.json and vitest.config.ts)
- **Env in tests**: All env vars are stubbed in setup. Use `resetEnvCache()` after modifying `process.env`.
- **Mock provider**: Set `USE_MOCK_PROVIDER=true` to skip real API calls.

## Environment

Required:
- `OPENAI_API_KEY` — OpenAI API key
- `API_SECRET_KEY` — Master bearer token for all routes

Provider keys (required per provider):
- `REPLICATE_API_TOKEN` — for Flux models
- `XAI_API_KEY` — for Grok Aurora

Optional infrastructure:
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (required for `output_format: "url"`)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis (legacy multi-tenant keys)
- `POSTGRES_URL` — Neon Postgres (usage tracking, user auth, MCP tokens)
- `WEBHOOK_SECRET` — Async webhook signing (min 16 chars)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Admin credentials

Optional with defaults:
- `CORTEX_BASE_URL` — must be HTTPS on `*.apexure.com`
- `DEFAULT_BRAND` — defaults to `apexure`
- `DEFAULT_PROVIDER` — `openai` | `replicate` | `mock` (default: `openai`)
- `CACHE_TTL_SECONDS` — brand data cache TTL (default: 3600)
- `RATE_LIMIT_PER_MINUTE` — per-client rate limit (default: 60)
- `MAX_CONCURRENT_GENERATES` — concurrency queue limit (default: 3)
- `LOG_LEVEL` — `debug` | `info` | `warn` | `error` (default: `info`)

## MCP Integration

- Cortex MCP server configured in `.mcp.json` for Claude Code to query brand data during development.
- The app itself serves as an MCP server at `POST /api/mcp` — any MCP client can connect using a bearer token or `?token=` query parameter.
