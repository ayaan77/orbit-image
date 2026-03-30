# Tunnel UX Redesign

## Context
Cloudflare Tunnel backend is working (manager, API, hook, CLI script). The current UI is a small section buried in the Connect tab. This redesign elevates the tunnel into a prominent sharing feature for team collaboration, client demos, and MCP ecosystem connectivity.

## Design Decisions
- **Placement**: Elevated Connect tab hero + Header pill badge
- **Stopped state**: Informational split card (text left, cloud+clients right)
- **Active state**: Integrated share grid (2x2 one-click copy cards)
- **Header**: Green pill badge, clickable → Connect tab, hidden when tunnel off

## Files to Modify
- `src/components/McpConnect.tsx` — Full hero redesign
- `src/components/McpConnect.module.css` — New styles
- `src/components/Header.tsx` — Tunnel pill badge
- `src/components/Dashboard.tsx` — Wire header click → Connect tab

## Backend (no changes needed)
- `src/lib/tunnel/manager.ts` — working
- `src/app/api/admin/tunnel/route.ts` — working
- `src/lib/client/useTunnel.ts` — working
