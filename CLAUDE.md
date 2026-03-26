# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js + Turbopack)
npm run build        # Production build
npm run start        # Start production server
npm test             # Run all tests (vitest)
npm test -- --run    # Run tests once (no watch)
npm test -- tests/unit/prompt/engine.test.ts  # Run a single test file
npm run test:coverage  # Tests with coverage
```

## Architecture

Orbit Image is a **brand-aware AI image generation service**. It pulls brand context (colors, voice, personas, proof) from the Cortex MCP API, assembles tailored prompts, and generates images via OpenAI's `gpt-image-1` model.

### Request Flow

```
Client POST /api/generate
  → auth (Bearer token, timing-safe compare)
  → rate limit (in-memory sliding window per client)
  → Zod validation (GenerateRequestSchema)
  → CachedCortexClient.getBrandContext() — parallel fetch of colours/voice/company/proof
  → PromptEngine.assemblePrompt() — brand context → PromptBundle
  → OpenAI provider.generate() — PromptBundle → base64 images
  → JSON response with images + metadata
```

### Key Layers

- **`src/lib/cortex/`** — Cortex MCP client. Uses JSON-RPC 2.0 over HTTP. `cached-client.ts` wraps the raw client with an in-memory TTL cache (brand data: configurable via `CACHE_TTL_SECONDS`, proof data: 15 min).
- **`src/lib/prompt/`** — Prompt assembly. `engine.ts` orchestrates: `templates.ts` provides purpose-specific templates (blog-hero, social-og, ad-creative, case-study, icon, infographic), `color-mapper.ts` converts brand colors to natural-language directives.
- **`src/lib/providers/`** — Image generation providers behind an `ImageProvider` interface. Currently only OpenAI (`gpt-image-1`). `factory.ts` resolves by name.
- **`src/lib/middleware/`** — Request pipeline: `auth.ts` (Bearer token), `rate-limit.ts` (sliding window), `validation.ts` (Zod + body size limit).
- **`src/lib/config/env.ts`** — Zod-validated env with caching. Call `resetEnvCache()` in tests.

### API Routes

- `POST /api/generate` — Main image generation endpoint (60s max duration on Vercel)
- `GET /api/brands` — List available brands from Cortex
- `GET /api/health` — Health check (Cortex reachability + OpenAI config)

All routes require `Authorization: Bearer <API_SECRET_KEY>`.

### Frontend

Single-page React app (`src/app/page.tsx`). Uses CSS Modules. State machine pattern: idle → loading → success/error. API key stored in `localStorage` under `orbit-api-key`.

## Testing

- **Framework**: Vitest with MSW for HTTP mocking
- **Setup**: `tests/mocks/setup.ts` stubs all env vars and initializes MSW server
- **Mock data**: `tests/mocks/cortex-responses.ts` has fixture data; `tests/mocks/handlers.ts` has MSW handlers
- **Path alias**: `@/` maps to `./src/` (configured in both tsconfig.json and vitest.config.ts)

## Environment

Required env vars (see `.env.example`):
- `OPENAI_API_KEY` — OpenAI API key
- `API_SECRET_KEY` — Bearer token for all API routes

Optional (with defaults):
- `CORTEX_BASE_URL` — must be HTTPS on `*.apexure.com`
- `DEFAULT_BRAND` — defaults to `apexure`
- `CACHE_TTL_SECONDS` — brand data cache TTL (default 3600)
- `RATE_LIMIT_PER_MINUTE` — per-client rate limit (default 60)

## MCP Integration

The project has a Cortex MCP server configured in `.mcp.json` for Claude Code to query brand data directly during development.
