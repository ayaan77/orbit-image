# Admin Panel Phase 1: Visual Overhaul

## Context
The admin panel is functional but visually basic compared to the main dashboard. Unicode icons, plain tables, native browser confirm() dialogs, and no loading skeletons. This redesign brings it to the same quality level.

## Design Decisions
- **Layout**: Refined sidebar matching main dashboard (220px, SVG icons, accent active state)
- **Stat Cards**: Gradient cards with glow (purple, blue, green, amber) — 2x2 grid
- **Tables**: Polished data tables with avatar initials, role badges, status dots, icon actions, sticky headers
- **Dialogs**: Styled ConfirmModal replacing browser confirm()
- **Loading**: Skeleton states for all pages

## Files to Modify/Create
- `src/app/admin/layout.tsx` + CSS — Sidebar redesign
- `src/app/admin/page.tsx` + CSS — Gradient stat cards
- `src/app/admin/loading.tsx` — Updated skeleton
- `src/components/admin/UserTable.tsx` + CSS — Polished table
- `src/components/admin/TokenTable.tsx` + CSS — Polished table
- `src/components/admin/ConfirmModal.tsx` + CSS — New shared modal
- `src/app/admin/tokens/page.tsx` — Updated wrapper
- `src/app/admin/users/page.tsx` — Updated wrapper

## No Backend Changes
All API endpoints, auth, data fetching, and CRUD operations remain unchanged.
