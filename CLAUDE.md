# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Monorepo with three apps under `apps/` and a reserved `packages/` directory for shared libraries / future add-ons:

- **apps/frontend/** — Nuxt 4 SPA frontend (Vue 3, `ssr: false`), TypeScript, ESM
- **apps/operations-api/** — Express 5 + Prisma + PostgreSQL backend (CommonJS), port 5001
- **apps/analytics-api/** — small Express + raw `pg` reporting API over a separate analytics database (`performance_reports`, `tenants`), port 5002
- **packages/** — shared code and add-on modules (empty for now; see `packages/README.md`)

Each app is self-contained with its own `package.json` and lockfile; the root `package.json` only orchestrates (`npm --prefix apps/...`). The PostgreSQL schema (and DB/user in dev) is named `frostlink`.

## Commands

All from repo root unless noted:

```bash
npm run install:all    # install deps for all three apps
npm run dev            # runs operations-api migrations, then frontend + both APIs (scripts/dev-all.mjs)
npm run dev:frontend   # Nuxt only (https dev server, port 5173)
npm run dev:api        # operations-api only
npm run dev:analytics  # analytics-api only
npm run build          # nuxt build
npm run lint           # eslint (frontend)
npm run typecheck      # nuxi typecheck
npm run test           # vitest run
npx vitest run utils/permissionPolicy.test.ts   # single frontend test file (cd apps/frontend)
```

operations-api (cd apps/operations-api):

```bash
npm run dev              # node server.js (no watcher)
npm run test             # node --test
node --test test/<file>  # single API test file
npm run lint
npm run migrate:deploy   # apply pending reversible migrations + regenerate schema docs
npm run migrate:down     # rollback last batch
npm run schema:extract   # regenerate database/schema/SCHEMA.md + schema.json from live DB
npx prisma generate      # regenerate Prisma client after schema.prisma changes
```

Docker dev stack: `docker compose up` (frontend 5173, API 5001, Postgres 5432; `docker-compose.override.yml` mounts app source for hot reload). UAT/prod variants: `docker-compose.uat.yml`, `docker-compose.prod.yml`. Each app builds from its own directory as Docker context (`apps/<app>/Dockerfile`).

Env setup: copy `.env.example` → `.env` at root (compose), in `apps/frontend/`, and in `apps/operations-api/`. The API exits at startup if `JWT_SECRET` or `MOBILE_API_KEY` is unset.

## Database & Migrations

Two migration systems exist in operations-api — use the reversible one:

- **`apps/operations-api/database/migrations/`** (current) — reversible SQL files with `-- UP` and `-- DOWN` sections, applied by `run-migrations.js` via `npm run migrate:deploy` / `migrate:down`. A post-migrate hook auto-regenerates `database/schema/SCHEMA.md` and `schema.json`; commit migration + updated schema docs together.
- **`apps/operations-api/migrations/`** (legacy) — forward-only SQL applied by `migrate.js` (`npm run migrate`). Don't add new files here.

Prisma is used as a **client only** over the existing `frostlink` schema (`prisma/schema.prisma`, `schemas = ["frostlink"]`) — schema changes go through raw SQL migrations, not `prisma migrate`. After changing `schema.prisma`, run `npx prisma generate`.

analytics-api has its own `run-migrations.js` and `migrations/` directory against the analytics database.

## Architecture

**Frontend** (`apps/frontend/`, Nuxt 4 SPA):
- Pinia stores in `stores/` are auto-imported (`imports.dirs`). Pages under `pages/` (dashboard pages like `performance-report.vue`, `redistribution.vue`, plus `admin/`, `region/`, `unit/` subdirs).
- API access goes through composables: `useApiClient.ts` (operations-api) and `useAnalyticsClient.ts` (analytics-api); base URLs come from `runtimeConfig.public.operationsApiBase` / `analyticsApiBase` (override via `NUXT_PUBLIC_*` env vars).
- Auth state in `stores/auth.ts` / `composables/useAuth.ts`; route guarding in `middleware/`. Permission logic in `utils/permissionPolicy.ts` (tested).
- UI: Tailwind CSS v4 (via `@tailwindcss/vite`, no tailwind.config), radix-vue + class-variance-authority components in `components/ui/`, chart.js via vue-chartjs, `@nuxtjs/color-mode` (light default).

**operations-api** (`apps/operations-api/`):
- Single large `server.js` containing all routes. Supporting modules: `prisma.js` (client), `db.js` (raw pg pool), `email.js` (SMTP or AWS SES), `asset-validation.js` (organisation asset-identifier rules), `env.js` (dotenv loading).
- Auth: JWT Bearer for users (payload: `id`, `username`, `permissions` ∈ Admin | Advanced | Intermediate | Basic); `x-api-key` header (MOBILE_API_KEY) for the mobile verification endpoint. `/signup` and `/login` are rate-limited.
- Prisma enum names use underscores; responses serialize them back to spaces (`serializePermission`). BigInt columns need string conversion before JSON.
- The full endpoint contract is documented in `apps/operations-api/API_CONTRACT.md` — keep it updated when changing routes.

**analytics-api** (`apps/analytics-api/`): read-only query endpoints using raw SQL over `pool` from `db.js`; no auth layer of its own.

## Git Guidelines

- Do not attempt to push commits directly to the `main`, `master`, or `uat` branches.
- Always create a new feature branch and commit changes there.
- If you need to merge changes, open a Pull Request instead of pushing directly.

## Reference Docs

- `docs/CODEBASE.md` — file structure and per-file purpose for the whole repo
- `apps/operations-api/API_CONTRACT.md` — operations-api endpoint contract
- `apps/analytics-api/API_CONTRACT.md` — analytics-api endpoint contract
- `apps/operations-api/database/schema/SCHEMA.md` — generated DB schema reference
- `DEVELOPMENT_WORKFLOW.md`, `DOCKER_*.md` — Docker workflows and deployment
- `MIGRATION_AUTOMATION.md` — migration automation details
