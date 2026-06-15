# Architecture

System-level view of the Shpmarketing (FrostLink) platform — how the apps, databases, and infrastructure fit together. For per-file detail see [CODEBASE.md](CODEBASE.md); for endpoints see the per-service `API_CONTRACT.md`.

## Overview

FrostLink is a fleet-management platform for monitoring refrigeration units ("fridges"). It is a monorepo of three apps over two PostgreSQL databases, fronted by Traefik in deployed environments.

```
                         ┌──────────────────────────────┐
                         │  Browser (SPA, Nuxt 4)        │
                         │  apps/frontend  :5173/:5174   │
                         └───────┬───────────────┬───────┘
                                 │ Bearer JWT    │ (no auth)
                                 ▼               ▼
                    ┌────────────────────┐  ┌────────────────────┐
                    │  operations-api    │  │  analytics-api     │
                    │  Express + Prisma  │  │  Express + raw pg  │
                    │  :5001             │  │  :5002             │
                    └─────────┬──────────┘  └─────────┬──────────┘
                              │ Prisma + pg            │ raw SQL (read-only)
                              ▼                        ▼
                    ┌────────────────────┐  ┌────────────────────┐
                    │ frostlink DB       │  │ analytics DB       │
                    │ schema: frostlink  │  │ schema: public     │
                    │ (assets, users,    │  │ (performance_      │
                    │  orgs, mismatches) │  │  reports, tenants, │
                    │                    │  │  iot_devices, …)   │
                    └────────────────────┘  └────────────────────┘
        Mobile client ──x-api-key──▶ operations-api /mobile/verify
```

In UAT/prod a **Traefik v3.4** reverse proxy terminates TLS (Let's Encrypt), routes the public host to the frontend, and strips the `/api` prefix for the operations-api. See `docker-compose.uat.yml` / `docker-compose.prod.yml` and `traefik/*-dynamic.yml`.

## Components

### Frontend — `apps/frontend` (Nuxt 4 SPA)
- `ssr: false` — pure client-side SPA. Dev server on 5173 (compose) / 5174 (`dev-all.mjs`), prod build served by Node on 3000 behind Traefik.
- Talks to **two** backends via separate composables: `useApiClient` (operations-api, injects Bearer token) and `useAnalyticsClient` (analytics-api, no auth).
- State in Pinia (`stores/`, auto-imported). Auth session persisted in `sessionStorage`; route access gated by `middleware/auth.ts` + `middleware/guest.ts`. Role capabilities mirror the backend in `utils/permissionPolicy.ts`.

### operations-api — `apps/operations-api` (Express 5 + Prisma)
- The system of record for **organisations, users, fridges (assets), mismatches, images, placements, and audit logs**. Single `server.js` with all routes.
- Two DB access paths: **Prisma** client (typed model access) and a raw **pg** pool (`db.js`) for transactional/bulk SQL and audit-trigger context (`myapp.current_user_id`).
- Auth: JWT Bearer for users; `x-api-key` for the mobile verification endpoint. Writes run in transactions; fridge changes are audited via DB triggers.

### analytics-api — `apps/analytics-api` (Express + raw pg)
- **Read-only** reporting over a separate analytics database. No auth layer of its own (must sit behind a gateway if exposed). Serves the performance dashboards, unit detail, and trend charts.
- Tenant scoping: a tenant maps to a set of devices (`tenants.iot_device_ids` → `iot_devices.id`/`wi_fi_mac`); reports filter by `mac_address` membership. See [ANALYTICS_SCHEMA.md](ANALYTICS_SCHEMA.md).

### Databases
- **frostlink DB** — operations data, schema named `frostlink`. Managed by raw SQL migrations; Prisma is a client only. Generated reference: [apps/operations-api/database/schema/SCHEMA.md](../apps/operations-api/database/schema/SCHEMA.md).
- **analytics DB** (`shpmarketing_analytics`) — telemetry-derived reporting tables in `public`, populated by stored procedures from raw `iot_telemetry`. Reference: [ANALYTICS_SCHEMA.md](ANALYTICS_SCHEMA.md).

The two databases are **independent** — there is no FK between them. They join logically on device identifiers (fridge serial, MAC, C-number) that appear in both domains.

## Request flows

### Authenticated dashboard request
1. User signs in → operations-api `POST /login` returns a 12h JWT + user object.
2. Frontend stores session in `sessionStorage`; `useApiClient` attaches `Authorization: Bearer <token>` on every operations-api call.
3. Analytics dashboards call analytics-api directly (no token); tenant + date are query params.
4. A 401 from operations-api triggers client logout + redirect to `/login`. See [AUTH.md](AUTH.md).

### Mobile verification
- A mobile client calls `POST /mobile/verify` with `x-api-key: <MOBILE_API_KEY>` (no JWT). Mismatches are created server-side when submitted identifiers disagree with the stored fridge record.

### Data pipeline (analytics)
- Raw device telemetry lands in `iot_telemetry`; scheduled stored procedures aggregate it into `performance_reports`, `maintenance_report`, `telemetry_3h_bins`, and the `precomputed_*` tables that the analytics-api reads. The APIs do not write these — they are produced by the database layer.

## Key architectural decisions

- **Two APIs, two DBs** — operational writes (assets/users) are isolated from heavy read-only reporting over telemetry, so reporting load and schema churn never affect the operational path.
- **Prisma as client-only over raw SQL migrations** — the `frostlink` schema predates Prisma and uses triggers/enums; migrations are hand-written reversible SQL (`database/migrations/`), and Prisma is regenerated against the live schema. `prisma migrate` is not used.
- **SPA, not SSR** — `ssr: false`; the frontend is a static bundle that talks to APIs, simplifying deployment (no Node render server logic) behind Traefik.
- **Permission policy duplicated front + back** — `utils/permissionPolicy.ts` mirrors the server's role/grant model so the UI can hide controls, but the operations-api is the enforcement point. Keep the two in sync.

## Environments

| Env | Compose file | Notes |
|---|---|---|
| Local | `docker-compose.yml` + `docker-compose.override.yml` | Hot-reload volume mounts; Postgres on 5432 |
| UAT | `docker-compose.uat.yml` + `traefik/uat-dynamic.yml` | Traefik TLS, `uat.frostlink.digital` |
| Prod | `docker-compose.prod.yml` + `traefik/prod-dynamic.yml` | HTTPS-only, `frostlink.scryui.com` |

Images build from per-app contexts (`apps/<app>/Dockerfile`) and push to `crg.apkg.io/digitaltwin_za`. CI in `bitbucket-pipelines.yml` (UAT auto-deploy, prod manual). Env vars: [ENVIRONMENT.md](ENVIRONMENT.md).
