
# Shpmarketing (FrostLink)

Monorepo: Nuxt 4 dashboard frontend with two companion Express + PostgreSQL APIs.

## Workspace Layout

- `apps/frontend` — Nuxt 4 SPA dashboard
- `apps/operations-api` — asset-management backend (port 5001)
- `apps/analytics-api` — read-only reporting backend (port 5002)
- `packages/` — shared libraries and future add-on modules

Each app is self-contained with its own `package.json`; root scripts orchestrate via `npm --prefix`.

## Commands

```bash
npm run install:all   # install deps for all apps
npm run dev           # migrations + frontend + both APIs
npm run dev:frontend  # Nuxt only
npm run dev:api       # operations-api only
npm run build
npm run lint
npm run test
```

Migrations (from `apps/operations-api`): `npm run migrate:deploy` applies pending reversible migrations and regenerates schema docs. Safe to run repeatedly.

## Environment

- Compose/root env: `.env.example` → `.env`
- Frontend env: `apps/frontend/.env.example` → `apps/frontend/.env`
- API env: `apps/operations-api/.env.example` → `apps/operations-api/.env`
- Analytics env: `apps/analytics-api/.env.example` → `apps/analytics-api/.env`

## Docs

- `docs/CODEBASE.md` — file structure and per-file purpose
- `apps/operations-api/API_CONTRACT.md`, `apps/analytics-api/API_CONTRACT.md` — endpoint contracts
- `DEVELOPMENT_WORKFLOW.md`, `DOCKER_*.md` — Docker workflows and deployment
