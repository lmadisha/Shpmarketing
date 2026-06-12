# Codebase Reference

File structure and purpose of every file in the Shpmarketing (FrostLink) repository. Three apps live in one repo: a Nuxt 4 SPA frontend (root), the operations-api (Express 5 + Prisma + PostgreSQL, port 5001), and the analytics-api (Express + raw `pg`, port 5002).

Companion docs: [CLAUDE.md](../CLAUDE.md) (working agreements & commands), [operations-api/API_CONTRACT.md](../operations-api/API_CONTRACT.md), [analytics-api/API_CONTRACT.md](../analytics-api/API_CONTRACT.md), [operations-api/database/schema/SCHEMA.md](../operations-api/database/schema/SCHEMA.md).

## Top-Level Layout

```
Shpmarketing/
├── app.vue, nuxt.config.ts, ...      Nuxt 4 SPA frontend (root app)
├── pages/ components/ stores/        Frontend source
│   composables/ utils/ middleware/
│   layouts/ plugins/ types/ assets/
├── operations-api/                   Asset-management backend (port 5001)
├── analytics-api/                    Read-only reporting backend (port 5002)
├── scripts/                          Dev orchestration scripts
├── deploy/ traefik/                  Deployment + reverse-proxy config
├── docs/                             Project documentation (this file, manuals, plans)
├── database_details/                 Reference SQL dumps and report queries
├── guidelines/                       Custom guideline template (unused)
└── docker-compose*.yml, Dockerfile   Container stack (dev / uat / prod)
```

---

## Root Configuration

| File | Purpose |
|---|---|
| `package.json` | Frontend manifest + workspace scripts (`dev`, `build`, `lint`, `test`, `typecheck`); deps: Nuxt 4, Vue 3, Pinia, Tailwind v4, radix-vue, chart.js |
| `nuxt.config.ts` | Nuxt config: `ssr: false` (SPA), HTTPS dev server, Pinia + color-mode modules, Tailwind v4 via Vite plugin, auto-import of `stores/`, runtime config `operationsApiBase` (5001) / `analyticsApiBase` (5002) |
| `app.vue` | Root component: favicon setup, `NuxtLayout`/`NuxtPage` outlet |
| `vitest.config.ts` | Vitest config for frontend unit tests |
| `eslint.config.mjs` | Frontend ESLint config (ignores build artifacts) |
| `postcss.config.mjs` | Empty placeholder — Tailwind v4 handled by `@tailwindcss/vite` |
| `tsconfig.json` | Extends Nuxt-generated tsconfig |
| `.env.example` | Frontend/dev env template: API base URLs, Postgres credentials (`frostlink`), ports, CORS origins |
| `.gitignore` / `.dockerignore` | Exclude build artifacts, env files, secrets, stray migrations |
| `README.md` | Project overview and basic command reference |
| `CLAUDE.md` | AI-assistant working instructions (layout, commands, migrations, git rules) |
| `ATTRIBUTIONS.md` | Credits (shadcn/ui, Unsplash) |
| `issue.md` | Known dev issue note: app-manifest resolution failure + cleanup fix |

## Frontend

### `pages/` — routes

| File | Purpose |
|---|---|
| `index.vue` | Redirects to `/admin/assets/inventory` (auth middleware) |
| `login.vue` | Email/password login form (guest middleware) |
| `signup.vue` | Account creation with organisation + permission-level selectors (guest middleware) |
| `overview.vue` | Client-side redirect to inventory |
| `workspace.vue` | User management: org filtering, role assignment, user CRUD, organisation CRUD, permission-hierarchy enforcement |
| `settings.vue` | Profile editor, password change, organisation asset-validation rules, system info (version, unit count) |
| `performance-report.vue` | Fleet health dashboard from analytics-api: summary metrics, flag-distribution pie charts, exportable unit table |
| `fleet-ranking.vue` | Units ranked by door opens with tier badges and compare-to-previous mode |
| `regional-map.vue` | Interactive map with region pins and regional KPI cards |
| `maintenance-report.vue` | Maintenance queue by priority, severity distribution, compressor diagnostics |
| `redistribution.vue` | Suggested unit relocations based on demand/tier drift |
| `reports.vue` | Report template cards (operational summary, maintenance queue, regional brief) |
| `region/[regionId].vue` | Regional drilldown: door-opens trend, compliance trend, top units |
| `unit/[unitId].vue` | Unit detail: door-opens / temperature / powered / voltage trends from analytics-api |
| `admin/assets.vue` | Asset-manager shell layout with audit-history timeline and child-route outlet |
| `admin/assets/index.vue` | Asset-manager landing redirect |
| `admin/assets/inventory.vue` | Fridge inventory table: search by MAC/serial/C-number, bulk ops, verification, Excel/CSV export |
| `admin/assets/add.vue` | Single-fridge create form with validation |
| `admin/assets/device-checker.vue` | Camera/QR device scanning and verification against operations-api |
| `admin/assets/mismatches.vue` | Mismatch list + resolution workflow (resolve / delete with note) |
| `admin/assets/history.vue` | Audit log of asset operations |
| `admin/assets/placement.vue` | Fridge placement capture with geolocation and serial/MAC scan |

### `components/`

| File | Purpose |
|---|---|
| `ui/Button.vue` | CVA button: default/destructive/outline/secondary/success/ghost/link variants, 4 sizes |
| `ui/Card.vue` | Rounded bordered card wrapper |
| `ui/Input.vue` | Text input with v-model and standard props |
| `ui/Select.vue` | Dropdown with search and keyboard navigation |
| `ui/Badge.vue` | Status badge with variants |
| `ui/Label.vue` | Form label |
| `ui/Textarea.vue` | Multi-line input |
| `ui/ModalDialog.vue` | Teleported modal with backdrop, Escape-close, header/footer slots |
| `layout/Sidebar.vue` | Permission-aware nav sidebar + mobile hamburger overlay |
| `layout/FilterBar.vue` | Global date/region/tier filter bar (currently hidden) |
| `dashboard/MetricCard.vue` | KPI card: title, value, subtitle, change% arrow |
| `dashboard/TrendChart.vue` | SVG line chart with hover tooltip, grid, legend |
| `dashboard/PieChart.vue` | Conic-gradient pie chart with legend and percentages |
| `dashboard/DistributionBars.vue` | Horizontal bar chart for category comparisons |
| `dashboard/TierBadge.vue` | Fleet tier badge (gold/silver/bronze/insufficient) |
| `dashboard/StatusBadge.vue` | Operational flag badge (ok/med/high/warn/bad/no-data) |
| `dashboard/InsightCard.vue` | Colored-border insight card (positive/warning/neutral) |
| `dashboard/AIAssistantDrawer.vue` | Right-side AI prompt drawer (placeholder) |
| `auth/AccessDeniedCard.vue` | Permission-denied error card |
| `settings/OrganisationAssetValidationSettingsCard.vue` | Per-organisation serial/MAC/C-number length-rule editor |

### `stores/` (Pinia, auto-imported)

| File | Purpose |
|---|---|
| `auth.ts` | Session state: login/signup/logout against operations-api, sessionStorage persistence, hydration |
| `adminAssets.ts` | Asset-manager state: permissions, org filter, validation-rules cache, inventory/mismatch/history data, bulk operations |

### `composables/`

| File | Purpose |
|---|---|
| `useApiClient.ts` | operations-api HTTP client: Bearer-token injection, 401 session-expiry handling, error parsing |
| `useAnalyticsClient.ts` | analytics-api HTTP client (no auth) |
| `useAuth.ts` | Thin wrapper exporting `useAuthStore` |

### `utils/`

| File | Purpose |
|---|---|
| `permissionPolicy.ts` | Source of truth for role capabilities: Admin/Advanced/Intermediate/Basic flags (`users.manage`, `assets.create`, …) and checks |
| `permissionPolicy.test.ts` | Vitest suite for the permission policy |
| `adminAssets.ts` | Asset helpers: Excel/CSV export, `normalizeCNumber`, `normalizeHexIdentifier`, value comparison |
| `organisationAssetValidation.ts` | Client-side identifier length-rule types, limits, and validation |
| `serialLookup.ts` | Serial normalization and exact-match lookup against inventory rows |
| `serialScanner.ts` | Camera barcode/QR scanning via native BarcodeDetector with @zxing fallback |
| `loggedFetch.ts` | Fetch wrapper logging requests/responses with `[api-client]` prefix |
| `cn.ts` | `clsx` + `tailwind-merge` class-name helper |

### Other frontend dirs

| File | Purpose |
|---|---|
| `middleware/auth.ts` | Route guard: requires hydrated session, else redirect `/login` |
| `middleware/guest.ts` | Route guard: redirects authenticated users to inventory |
| `layouts/dashboard.vue` | Main layout: sidebar + content slot + AI drawer trigger |
| `plugins/auth.client.ts` | Client-only plugin hydrating auth store from sessionStorage at startup |
| `types/adminAssets.ts` | Shared types: `Fridge`, `Mismatch`, `AuditLogRow`, bulk-operation types, sort keys, permission flags |
| `assets/css/index.css` | CSS entrypoint importing Tailwind/theme/fonts |
| `assets/css/tailwind.css` | Tailwind v4 layer setup |
| `assets/css/theme.css` | Brand theme variables (blue #006aea, slate/emerald/amber/red accents) |
| `assets/css/fonts.css` | Font-face declarations |
| `assets/css/img/` | FrostLink logo assets (PNG + SVG) |

---

## operations-api/ (port 5001)

| File | Purpose |
|---|---|
| `server.js` | Entire HTTP API in one file (~3,100 lines): auth (JWT + rate-limited login/signup), profile, organisations, users + permissions, fridges CRUD, bulk upload/preview/update (CSV/XLSX via multer + xlsx), mismatches (mobile verify + manual + resolve/delete), audit log, placement. Contract: `API_CONTRACT.md` |
| `prisma.js` | Prisma client instance over the `frostlink` schema |
| `db.js` | Raw `pg` pool with localhost normalization and startup connection check |
| `email.js` | Email abstraction: SMTP (nodemailer) or AWS SES; sends welcome emails |
| `env.js` | dotenv loader + sanitized DB-connection summary logging |
| `asset-validation.js` | Server-side identifier validation: org-level min/max length rules, MAC/C-number normalization, coordinate parsing |
| `run-migrations.js` | **Current** migration runner: reversible `-- UP`/`-- DOWN` files in `database/migrations/`, advisory locking, checksums, `--down` rollback |
| `migrate.js` | **Legacy** forward-only runner for `migrations/` (don't add new files there) |
| `schema.sql` | Legacy schema baseline (superseded by migrations + schema docs) |
| `prisma/schema.prisma` | Prisma models: Organisation, OrganisationAssetValidationRules, User, Fridge, FridgeMismatch, FridgeImage, FridgeAuditLog, FridgePlacement + permission/mismatch enums. Client-only — schema changes go through SQL migrations |
| `Dockerfile` | Node 20 slim image; `prisma generate`, dev-deps prune, runs `start:with-migrations` |
| `package.json` | Scripts: `dev`, `test` (node --test), `migrate:deploy`/`migrate:down`, `schema:extract`, `start:with-migrations` |
| `eslint.config.mjs` | API ESLint config (Node globals) |
| `.env.example` | Env template: PORT, DB credentials/`DATABASE_URL`, `JWT_SECRET`, `MOBILE_API_KEY` (both required), CORS, SMTP/SES |
| `API_CONTRACT.md` | Full endpoint contract — keep updated when changing routes |

### `operations-api/migrations/` (legacy, applied)

| File | Purpose |
|---|---|
| `001_organisation_asset_validation_rules.sql` | Creates `organisation_asset_validation_rules`; widens fridge identifier columns |
| `002_device_checker_location.sql` | Adds location columns to `fridges` |
| `003_fridge_audit_organisation_scope.sql` | Adds organisation scope to `fridge_audit_log` |
| `004_mismatch_audit_action_names.sql` | Rewrites mismatch audit trigger function action names |
| `005_add_fridge_images.sql` | Creates `fridge_images` table |
| `006_add_fridge_placement.sql` | Creates `fridge_placement` table |
| `007_add_fridge_placed.sql` | Adds `placed` flag to `fridges` |
| `008_add_deletion_reason.sql` | Adds `deletion_reason` to `fridge_audit_log` |

### `operations-api/database/` (current migration system)

| File | Purpose |
|---|---|
| `README.md` | Migration workflow guide (UP/DOWN format, schema-doc regeneration) |
| `extract-schema.js` | Dumps live DB structure to `schema/SCHEMA.md` + `schema/schema.json` |
| `post-migrate.js` | Hook invoking extract-schema after each migrate run |
| `migration-checksum.js` | SHA-256 migration checksums with CRLF/LF normalization |
| `migrations/001_add_direction_to_migrations.sql` | Adds `direction` column to migration-tracking table |
| `migrations/002_organisation_asset_validation_rules.sql` | Reversible version of validation-rules table |
| `migrations/003_add_fridge_placed_column.sql` | Adds `fridges.placed` boolean |
| `migrations/004_add_fridge_audit_log_columns.sql` | Adds `deletion_reason` + `organisation_id` to audit log |
| `schema/SCHEMA.md` | Generated human-readable DB schema reference |
| `schema/schema.json` | Generated machine-readable schema snapshot |

### `operations-api/test/`

| File | Purpose |
|---|---|
| `smoke.test.js` | Baseline scaffold test |
| `asset-validation.test.js` | Tests identifier normalization/validation helpers |
| `migration-checksum.test.js` | Tests checksum calculation/normalization |
| `placement-permissions.test.js` | Tests placement endpoint permission checks |

---

## analytics-api/ (port 5002)

| File | Purpose |
|---|---|
| `server.js` | Read-only reporting endpoints over the analytics DB: `/health`, `/filters/dates`, `/filters/tenants`, `/performance/summary`, `/performance/distributions`, `/performance/units`, `/unit/:mac`, `/unit/:mac/trends`. Tenant scoping via `tenants.iot_device_ids` → `iot_devices.wi_fi_mac`. No auth. Contract: `API_CONTRACT.md` |
| `db.js` | `pg` pool for the analytics database (`shpmarketing_analytics`) |
| `run-migrations.js` | Reversible migration runner (same design as operations-api) against `public` schema |
| `migrations/` | Empty — no analytics migrations yet |
| `Dockerfile` | Node 20 slim, prod deps only, runs `node server.js` |
| `package.json` | Scripts: `migrate:deploy`, `migrate:down`; deps: express, pg, cors, dotenv |
| `.env.example` | Env template: PORT 5002, `ANALYTICS_DB_*`, CORS |
| `API_CONTRACT.md` | Full endpoint contract |

---

## Tooling & Infrastructure

### `scripts/`

| File | Purpose |
|---|---|
| `dev-all.mjs` | `npm run dev` entrypoint: runs operations-api migrations first, then spawns API(s) + Nuxt; SIGINT/SIGTERM cleanup |
| `patch-vite-net-use.cjs` | Windows workaround suppressing `net use` permission errors from Vite/esbuild child processes |

### Docker & deployment

| File | Purpose |
|---|---|
| `Dockerfile` | Frontend multi-stage build (Node 20), serves `.output/server/index.mjs` on port 3000 |
| `docker-compose.yml` | Base dev stack: Postgres, operations-api, analytics-api, frontend; `frostlink` network, healthchecks |
| `docker-compose.override.yml` | Dev hot-reload: mounts source volumes, `NODE_ENV=development` |
| `docker-compose.uat.yml` | UAT stack + Traefik v3.4, Let's Encrypt TLS, `uat.frostlink.digital`, dashboard :8081 |
| `docker-compose.prod.yml` | Prod stack + Traefik, `frostlink.scryui.com`, HTTPS-only with HTTP redirect |
| `bitbucket-pipelines.yml` | CI/CD: builds + pushes images to `crg.apkg.io/digitaltwin_za`; UAT auto-deploy, prod manual |
| `deploy/uat/docker-compose.uat.yml` | Server-side copy of the UAT compose file |
| `traefik/uat-dynamic.yml` | UAT Traefik routes: hosts, API prefix strip, fallback redirects |
| `traefik/prod-dynamic.yml` | Prod Traefik routes (same pattern) |

### `docs/`

| File | Purpose |
|---|---|
| `CODEBASE.md` | This file — file structure and per-file purpose |
| `permission-role-matrix.md` | Role → permission mapping (37 permissions across assets, mismatches, history, device-checker, placement, workspace, users, profile, org validation) |
| `user-manual.md` | End-user functionality guide |
| `plans/PLAN_2026_03_25_report_api.md` | Implementation plan for the report (analytics) API |
| `superpowers/plans/` | Feature plans authored via the superpowers workflow |

### Root operational docs

| File | Purpose |
|---|---|
| `DEPLOYMENT_CHECKLIST.md` | Pre-deploy / UAT / prod checklists |
| `DEVELOPMENT_WORKFLOW.md` | Daily Docker dev workflow, hot reload, DB access |
| `DOCKER_DEPLOYMENT.md` | Production Docker stack guide (Traefik + Let's Encrypt) |
| `DOCKER_COMPOSE_GUIDE.md` | Compose architecture and per-environment differences |
| `DOCKER_BUILD_PUSH.md` | Building and pushing images to the registry |
| `DOCKER_QUICK_REFERENCE.md` | Docker command cheatsheet |
| `DOCKER_STACK_UPDATE_SUMMARY.md` | Changelog of the April 2026 Docker stack rework |
| `MIGRATION_AUTOMATION.md` | Migration-runner internals (advisory locks, checksums, failure modes) |
| `NETWORK_SETUP.md` | LAN access setup (IP, CORS, Windows Firewall) |

### Reference data

| File | Purpose |
|---|---|
| `database_details/schema.sql` | Full reference schema dump (~151 KB) |
| `database_details/artic.sql` | Artic-specific setup script |
| `database_details/performance_reports_query/` | Reference SQL for performance-report data |
| `database_details/maintenance_report_queries/` | Reference SQL for maintenance-report data |
| `guidelines/Guidelines.md` | Unfilled guideline template |
