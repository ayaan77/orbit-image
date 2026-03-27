# Orbit Image

**Brand-aware AI image generation** for the Apexure ecosystem.

Orbit Image pulls brand context (colors, voice, personas, proof) from the Cortex MCP API, assembles tailored prompts, and generates images via multiple AI providers (OpenAI, Replicate, xAI). Every generated image is automatically aligned with your brand identity.

**Live:** [orbit-image.vercel.app](https://orbit-image.vercel.app)

---

## Why Orbit Image?

Marketing teams need on-brand visuals constantly — blog heroes, social OG images, ad creatives, case study graphics, icons, infographics. Traditional workflows involve writing a prompt, generating a generic image, manually adjusting colors/style to match brand guidelines, and repeating for every brand.

**Orbit Image automates all of it.** It fetches your brand data from Cortex and bakes it directly into the AI prompt. The result: brand-consistent images in seconds.

### Who is this for?

- **Marketing teams** — generate on-brand visuals without a designer
- **Agencies managing multiple brands** — switch brands with one parameter
- **Developers** — integrate via REST API or MCP protocol into any workflow
- **AI agents** — use the MCP endpoint for autonomous brand-aware image generation
- **Anyone curious** — try the public Studio page, no signup needed

---

## Features

| Feature | Description |
|---------|-------------|
| **Brand-aware prompts** | Pulls brand colors, voice, audience, and proof from Cortex MCP |
| **6 AI models** | GPT Image 1, DALL-E 3 (OpenAI), Flux Pro/Dev/Schnell (Replicate), Grok Aurora (xAI) |
| **6 purpose templates** | Blog Hero, Social OG, Ad Creative, Case Study, Icon, Infographic |
| **6 style options** | Photographic, Illustration, 3D Render, Flat Design, Abstract, Minimalist |
| **Public Studio** | Try brand-aware generation at `/studio` — no account needed |
| **Self-serve signup** | Get an API key instantly from Studio with trial limits |
| **Admin Dashboard** | Overview, Apps, Playground, Usage, Quick Start — full admin UI |
| **Multi-tenant API keys** | Per-client keys with scopes, rate limits, and monthly budgets |
| **Async generation** | Background jobs with webhook delivery (HMAC-signed) |
| **Usage tracking** | Per-client usage logs with cost estimation and budget enforcement |
| **Image CDN** | Upload to Vercel Blob, return fast CDN URLs |
| **MCP integration** | JSON-RPC 2.0 endpoint for Claude, Cursor, and AI agents |
| **Rate limiting** | Sliding window per client (Redis primary, in-memory fallback) |
| **Mock provider** | Free testing mode — no AI costs during development |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/ayaan77/orbit-image.git
cd orbit-image
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

**Required:**

```
OPENAI_API_KEY=sk-...          # OpenAI API key
API_SECRET_KEY=your-secret     # Master key for all API routes
```

**For free testing without AI costs:**

```
USE_MOCK_PROVIDER=true
```

### 3. Run

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm test             # Run all 307 tests
npm run test:coverage  # With coverage report
```

### 4. Try it

- **Dashboard:** `http://localhost:3000` (enter your `API_SECRET_KEY`)
- **Studio:** `http://localhost:3000/studio` (public, no key needed)

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key — enables GPT Image 1 and DALL-E 3 |
| `API_SECRET_KEY` | Master auth token — protects all API routes |

### AI Providers (optional — each unlocks more models)

| Variable | Provider | Models |
|----------|----------|--------|
| `REPLICATE_API_TOKEN` | Replicate | Flux Pro, Flux Dev, Flux Schnell |
| `XAI_API_KEY` | xAI | Grok Aurora |

### Brand Context (optional)

| Variable | Description |
|----------|-------------|
| `CORTEX_BASE_URL` | Cortex MCP endpoint (HTTPS on `*.apexure.com`) |
| `DEFAULT_BRAND` | Auto-select brand (default: `apexure`) |

### Infrastructure (optional — each unlocks features)

| Variable(s) | Service | What it enables |
|-------------|---------|-----------------|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis | Per-app API keys, rate limiting, async jobs |
| `POSTGRES_URL` | Neon Postgres | Usage tracking, cost analytics, webhook logs |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | CDN image URLs instead of base64 |
| `WEBHOOK_SECRET` | — | HMAC-signed webhook delivery |

### Tuning (optional — sensible defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_PER_MINUTE` | `60` | Max requests per client per minute |
| `MAX_CONCURRENT_GENERATES` | `3` | Parallel generation slots |
| `CACHE_TTL_SECONDS` | `3600` | Brand context cache (1 hour) |
| `IMAGE_CACHE_TTL_SECONDS` | `86400` | Image result cache (24 hours) |
| `LOG_LEVEL` | `info` | Logging: debug, info, warn, error |

---

## Architecture

```
Client Request (REST / MCP / Studio)
       │
  Authorization: Bearer <key>
       │
  [Auth] ─── master key (sync) or client key (Redis lookup)
       │
  [Rate Limiter] ─── sliding window per client
       │
  [Zod Validation]
       │
  [CachedCortexClient] ─── brand colors, voice, company, proof
       │                    (in-memory cache, configurable TTL)
       │
  [PromptEngine] ─── brand context + request → tailored prompt
       │
  [Provider] ─── OpenAI / Replicate / xAI → images
       │
  [Blob Upload] ─── optional CDN URL conversion
       │
  Response ─── images + metadata
       │
  [Usage Logger] ─── async Postgres INSERT (non-blocking)
  [Webhook] ─── async HMAC-signed delivery (if configured)
```

### Key Layers

| Layer | Path | Purpose |
|-------|------|---------|
| **Cortex client** | `src/lib/cortex/` | JSON-RPC 2.0 client with in-memory TTL cache |
| **Prompt engine** | `src/lib/prompt/` | Purpose templates, color mapping, prompt assembly |
| **Providers** | `src/lib/providers/` | OpenAI, Replicate, xAI behind `ImageProvider` interface |
| **Middleware** | `src/lib/middleware/` | Auth, rate limiting, CORS, Zod validation, IP rate limit |
| **Auth** | `src/lib/auth/` | Key generation, hashing, multi-tenant lookup |
| **Jobs** | `src/lib/jobs/` | Async processor, job store (Redis), webhook delivery |
| **Usage** | `src/lib/usage/` | Cost estimation, async Postgres logging |
| **Config** | `src/lib/config/` | Zod-validated environment with caching |

---

## API Reference

All routes require `Authorization: Bearer <API_KEY>` unless noted.

### `POST /api/generate`

Generate brand-aware images.

```bash
curl -X POST https://orbit-image.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "topic": "A futuristic dashboard showing real-time analytics",
    "purpose": "blog-hero",
    "model": "gpt-image-1",
    "quality": "hd",
    "count": 1,
    "style": "photographic",
    "brand": "apexure",
    "output_format": "url"
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | What to generate (1-500 chars) |
| `purpose` | enum | Yes | `blog-hero`, `social-og`, `ad-creative`, `case-study`, `icon`, `infographic` |
| `model` | enum | No | `gpt-image-1`, `dall-e-3`, `flux-pro`, `flux-dev`, `flux-schnell`, `grok-aurora` |
| `quality` | enum | No | `standard` or `hd` (default: `hd`) |
| `count` | number | No | 1-4 images (default: 1) |
| `style` | enum | No | `photographic`, `illustration`, `3d-render`, `flat-design`, `abstract`, `minimalist` |
| `brand` | string | No | Brand slug (default: `apexure`) |
| `output_format` | enum | No | `base64` or `url` (default: `base64`) |
| `async` | boolean | No | `true` for background generation with job polling/webhooks |
| `webhook_url` | string | No | HTTPS URL for async delivery |

### `GET /api/brands`

List available brands from Cortex.

### `GET /api/health`

Health check — Cortex reachability, OpenAI config, queue stats.

### `GET /api/jobs/:id`

Poll async job status. Returns images when complete.

### `POST /api/mcp`

MCP JSON-RPC 2.0 endpoint for AI agent integration.

```bash
curl -X POST https://orbit-image.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tools: `generate-image`, `list-brands`, `health-check`.

### Studio Routes (no auth — public, IP rate-limited)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/studio/preview` | POST | Compare generic vs brand-aware prompts (10/hour) |
| `/api/studio/generate` | POST | Demo image generation (3/day) |
| `/api/studio/signup` | POST | Self-serve API key provisioning (1/hour) |

### Admin Routes (master key only)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/keys` | POST/GET/PATCH | Create, list, update client API keys |
| `/api/admin/replace-key` | POST | Revoke and reissue a client key |
| `/api/admin/usage` | GET | Query usage logs (filter by client, brand, date) |
| `/api/admin/services` | GET | Test all service connections |
| `/api/admin/config` | GET | Read server configuration |
| `/api/admin/preview-prompt` | POST | Preview prompt assembly without generating |
| `/api/admin/cache` | DELETE | Flush image cache |
| `/api/admin/webhook-logs` | GET | Query webhook delivery attempts |

---

## Frontend

### Dashboard (`/`)

Admin dashboard with 5 tabs:

- **Overview** — stats, service status, setup checklist with step-by-step guides
- **Apps** — create/revoke API keys, view integration code (cURL, JS, Python)
- **Playground** — test image generation with all models and options
- **Usage** — per-client usage analytics with cost breakdown
- **Quick Start** — developer integration guide with reference tables

### Studio (`/studio`)

Public-facing page — no auth required:

1. **Describe** — enter topic and pick purpose
2. **Compare** — see generic vs brand-aware prompt side by side
3. **Generate** — get a free demo image (3/day)
4. **Get Access** — self-serve API key signup with trial limits

---

## Testing

```bash
npm test              # Watch mode
npm test -- --run     # Single run (307 tests)
npm run test:coverage # With coverage report
```

- **Framework:** Vitest + MSW for HTTP mocking
- **Test files:** 33 test files across unit and integration
- **Mock provider:** Set `USE_MOCK_PROVIDER=true` to skip AI API calls

---

## Deployment

Deployed on **Vercel** with optional integrations:

| Service | Purpose | Required |
|---------|---------|----------|
| Vercel | Hosting + edge | Yes |
| OpenAI | Image generation | Yes |
| Cortex MCP | Brand data | No (images work without it, just generic) |
| Upstash Redis | API keys, async jobs | No (falls back to master-key-only) |
| Neon Postgres | Usage tracking | No (no tracking without it) |
| Vercel Blob | Image CDN URLs | No (returns base64 without it) |

---

## Tech Stack

| Technology | Role |
|-----------|------|
| **Next.js 15** | Framework (App Router, Turbopack) |
| **React 19** | Frontend UI |
| **TypeScript** | Type safety |
| **OpenAI** | Image generation (GPT Image 1, DALL-E 3) |
| **Replicate** | Image generation (Flux Pro/Dev/Schnell) |
| **xAI** | Image generation (Grok Aurora) |
| **Cortex MCP** | Brand data provider (JSON-RPC 2.0) |
| **Upstash Redis** | API keys, rate limiting, job store |
| **Neon Postgres** | Usage tracking, webhook logs |
| **Vercel Blob** | Image CDN storage |
| **Zod** | Request validation |
| **Vitest + MSW** | Testing |
| **Vercel** | Hosting |

---

## Project Structure

```
src/
  app/
    api/
      generate/route.ts       # Main image generation
      brands/route.ts          # List brands
      health/route.ts          # Health check
      mcp/route.ts             # MCP JSON-RPC endpoint
      jobs/[id]/route.ts       # Async job polling
      studio/                  # Public studio APIs (preview, generate, signup)
      admin/                   # Admin APIs (keys, usage, config, cache, webhooks)
    page.tsx                   # Dashboard + generator
    studio/page.tsx            # Public Studio page
    globals.css                # Design tokens
  components/                  # React components (15+)
  lib/
    cortex/                    # Cortex MCP client + cache
    prompt/                    # Prompt engine + templates
    providers/                 # OpenAI, Replicate, xAI adapters
    middleware/                # Auth, rate limit, CORS, validation, IP rate limit
    auth/                      # Key management (generate, hash, lookup)
    jobs/                      # Async processor, job store, webhook delivery
    usage/                     # Cost estimation + logging
    config/                    # Zod-validated env
    storage/                   # Redis (kv.ts) + Postgres (db.ts) clients
    client/                    # Client-side utilities (storage, snippets)
tests/
  unit/                        # Unit tests (auth, prompt, cortex, providers, components)
  integration/                 # API route tests
  mocks/                       # MSW handlers + fixtures
```

---

## License

Private. Part of the Apexure ecosystem.
