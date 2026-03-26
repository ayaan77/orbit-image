# Orbit Image

**Brand-aware AI image generation** for the Apexure ecosystem.

Orbit Image pulls brand context (colors, voice, personas, proof) from the Cortex MCP API, assembles tailored prompts, and generates images via OpenAI's `gpt-image-1` model. Every generated image is automatically aligned with your brand identity.

**Live:** [orbit-image.vercel.app](https://orbit-image.vercel.app)

---

## Why Orbit Image?

Marketing teams need on-brand visuals constantly — blog heroes, social OG images, ad creatives, case study graphics, icons, infographics. Traditional workflows involve:

1. Writing a prompt manually
2. Generating a generic image
3. Manually adjusting colors/style to match brand guidelines
4. Repeating for every brand you manage

**Orbit Image automates steps 1-3.** It fetches your brand data from Cortex (colors, tone, audience, proof points) and bakes it directly into the image generation prompt. The result: brand-consistent images in seconds, not hours.

### Who is this for?

- **Marketing teams** — generate on-brand visuals without a designer
- **Agencies managing multiple brands** — switch brands with one parameter
- **Developers** — integrate via REST API or MCP protocol into any workflow
- **AI agents** — use the MCP endpoint for autonomous brand-aware image generation

---

## Features

| Feature | Description |
|---------|-------------|
| **Brand-aware prompts** | Automatically pulls brand colors, voice, and audience from Cortex MCP |
| **6 purpose templates** | Blog Hero, Social OG, Ad Creative, Case Study, Icon, Infographic |
| **6 style options** | Photographic, Illustration, 3D Render, Flat Design, Abstract, Minimalist |
| **Multi-tenant API keys** | Each client gets their own key; revoke individually |
| **Usage tracking** | Per-client usage logs with cost estimation |
| **Dual interface** | REST API + MCP (JSON-RPC 2.0) for AI agent integration |
| **Rate limiting** | Per-client sliding window rate limiter |
| **Mock provider** | Free testing mode — no OpenAI costs during development |

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

Edit `.env` with your keys:

```
OPENAI_API_KEY=sk-...          # Required — OpenAI API key
API_SECRET_KEY=your-secret     # Required — master key for all API routes
```

For free testing without OpenAI costs:

```
USE_MOCK_PROVIDER=true
```

### 3. Run

```bash
npm run dev     # Development server at http://localhost:3000
npm run build   # Production build
npm test        # Run all 115 tests
```

---

## Architecture

```
Client Request (REST or MCP)
       |
  Authorization: Bearer <key>
       |
  [Auth Middleware] ─── master key? (sync, 0ms) ─── proceed
       |                    |
       |              client key? ─── Upstash Redis lookup (~2ms)
       |
  [Rate Limiter] ─── sliding window per client
       |
  [Zod Validation]
       |
  [CachedCortexClient] ─── fetch brand colors, voice, company, proof
       |                    (cached in-memory, configurable TTL)
       |
  [PromptEngine] ─── brand context + user request → tailored prompt
       |
  [OpenAI Provider] ─── gpt-image-1 → base64 images
       |
  Response ─── images + metadata
       |
  [Usage Logger] ─── async INSERT to Neon Postgres (non-blocking)
```

### Key layers

| Layer | Path | Purpose |
|-------|------|---------|
| **Cortex client** | `src/lib/cortex/` | JSON-RPC 2.0 client with in-memory TTL cache |
| **Prompt engine** | `src/lib/prompt/` | Purpose templates, color mapping, prompt assembly |
| **Providers** | `src/lib/providers/` | OpenAI adapter behind `ImageProvider` interface |
| **Middleware** | `src/lib/middleware/` | Auth, rate limiting, Zod validation |
| **Auth** | `src/lib/auth/` | Key generation, hashing, multi-tenant lookup |
| **Usage** | `src/lib/usage/` | Cost estimation, async Postgres logging |

---

## API Reference

All routes require `Authorization: Bearer <API_KEY>`.

### `POST /api/generate`

Generate brand-aware images.

```bash
curl -X POST https://orbit-image.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "topic": "A futuristic dashboard showing real-time analytics",
    "purpose": "blog-hero",
    "quality": "hd",
    "count": 2,
    "style": "photographic",
    "brand": "apexure"
  }'
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `topic` | string | Yes | What to generate (1-500 chars) |
| `purpose` | enum | Yes | `blog-hero`, `social-og`, `ad-creative`, `case-study`, `icon`, `infographic` |
| `quality` | enum | No | `standard` or `hd` (default: `hd`) |
| `count` | number | No | 1-4 images (default: 1) |
| `style` | enum | No | `photographic`, `illustration`, `3d-render`, `flat-design`, `abstract`, `minimalist` |
| `brand` | string | No | Brand slug (default: `apexure`) |

### `GET /api/brands`

List available brands from Cortex.

### `GET /api/health`

Health check — returns status of Cortex, OpenAI, and overall system health.

### `POST /api/mcp`

MCP JSON-RPC 2.0 endpoint for AI agent integration.

```bash
curl -X POST https://orbit-image.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Available MCP tools: `generate-image`, `list-brands`, `health-check`.

### Admin routes (master key only)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/keys` | POST | Create a new client API key |
| `/api/admin/keys` | GET | List all clients |
| `/api/admin/keys` | DELETE | Revoke a client key |
| `/api/admin/usage` | GET | Query usage logs (filter by client, brand, date) |

---

## Multi-Tenant Setup

Orbit Image supports multiple clients, each with their own API key:

1. **Master key** (`API_SECRET_KEY`) — admin access, manages other keys
2. **Client keys** (`oimg_live_...`) — per-client, stored as SHA-256 hashes in Upstash Redis

### Create a client key

```bash
curl -X POST https://orbit-image.vercel.app/api/admin/keys \
  -H "Authorization: Bearer MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "Marketing Team", "clientId": "marketing"}'
```

Returns the raw key once — store it securely.

### External services (optional)

| Service | Purpose | Env vars |
|---------|---------|----------|
| **Upstash Redis** | API key hash storage | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| **Neon Postgres** | Usage logging | `POSTGRES_URL` |

Without these, Orbit Image falls back to master-key-only mode with no usage tracking.

---

## Testing

```bash
npm test              # Watch mode
npm test -- --run     # Single run (115 tests)
npm run test:coverage # With coverage report
```

- **Framework:** Vitest + MSW for HTTP mocking
- **Coverage:** Unit tests (auth, prompt, cortex, usage, MCP) + integration tests (API routes, admin, MCP)
- **Mock provider:** Set `USE_MOCK_PROVIDER=true` to skip OpenAI calls entirely

---

## Deployment

Deployed on **Vercel** with:

- **Upstash Redis** — multi-tenant API key storage
- **Neon Postgres** — usage tracking database
- **Neon branch-per-PR** — isolated database branches for pull requests

### Environment variables to set in Vercel

```
OPENAI_API_KEY          # OpenAI API key
API_SECRET_KEY          # Master/admin key
CORTEX_BASE_URL         # Cortex MCP endpoint
KV_REST_API_URL         # Upstash Redis REST URL
KV_REST_API_TOKEN       # Upstash Redis token
POSTGRES_URL            # Neon Postgres connection string
```

---

## Tech Stack

| Technology | Role |
|-----------|------|
| **Next.js 15** | Framework (App Router, Turbopack) |
| **React 19** | Frontend UI |
| **TypeScript** | Type safety throughout |
| **OpenAI** | Image generation (gpt-image-1) |
| **Cortex MCP** | Brand data provider (JSON-RPC 2.0) |
| **Upstash Redis** | Serverless API key storage |
| **Neon Postgres** | Serverless usage database |
| **Zod** | Request validation |
| **Vitest + MSW** | Testing |
| **Vercel** | Hosting + edge infrastructure |

---

## Project Structure

```
src/
  app/
    api/
      generate/route.ts    # Main image generation
      brands/route.ts       # List brands
      health/route.ts       # Health check
      mcp/route.ts          # MCP JSON-RPC endpoint
      admin/keys/route.ts   # Client key management
      admin/usage/route.ts  # Usage logs
    page.tsx                # Frontend app
    globals.css             # Design tokens
  components/               # React components (6 total)
  lib/
    cortex/                 # Cortex MCP client + cache
    prompt/                 # Prompt engine + templates
    providers/              # OpenAI adapter
    middleware/             # Auth, rate limit, validation
    auth/                   # Key management
    usage/                  # Cost estimation + logging
    config/                 # Zod-validated env
tests/
  unit/                     # Unit tests
  integration/              # API route tests
  mocks/                    # MSW handlers + fixtures
```

---

## License

Private. Part of the Apexure ecosystem.
