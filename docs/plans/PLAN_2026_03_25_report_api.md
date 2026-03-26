## Reports API Split + Global Report Filters

### Summary
- Add a new standalone `reports-api` service (separate folder, separate process) for performance and maintenance reporting, backed by the report database.
- Keep authentication unified by validating existing JWTs in `reports-api` with the same `JWT_SECRET`.
- Enforce tenant scope as: `Admin` can access all tenants; non-admin users are restricted to tenant mapped from `operations.organisation.name`.
- Replace the existing global `FilterBar` UI app-wide with report-driven filters (tenant/date/mac), and wire performance + maintenance pages to real endpoints.

### Implementation Changes
- Create new folder `reports-api/` with:
  - `server.js`, `env.js`, `package.json`, `.env.example`, `test/`.
  - `db/reports-db.js` for reporting DB pool.
  - `db/ops-db.js` for operations DB read pool (user/org lookup for scope).
  - `auth/require-auth.js` for JWT verification.
  - `scope/tenant-scope.js` to resolve allowed tenants per user.
  - `routes/reports.js` + `services/reports-service.js` for query execution.
- Add `reports-api` endpoints (read-only):
  - `GET /health`
  - `GET /reports/filters/tenants`
  - `GET /reports/filters/dates?tenant=<name|all>`
  - `GET /reports/filters/macs?tenant=<name|all>&date=YYYY-MM-DD`
  - `GET /reports/performance/dashboard?...`
  - `GET /reports/maintenance/dashboard?...`
  - `GET /reports/maintenance/mac-summary?...`
  - `GET /reports/maintenance/mac-temperature-series?...`
  - `GET /reports/maintenance/mac-telemetry-series?...`
- Use parameterized SQL only; no string interpolation. Lift logic from provided SQL files into service-layer query functions and normalize outputs to frontend-friendly JSON.
- Define dashboard endpoint contracts:
  - Performance dashboard returns KPI strip, fleet-state distribution, temp/voltage/power distributions, spotlight lists, and paginated/sortable table rows.
  - Maintenance dashboard returns measured vs not measured counts, severity distribution + ranked list, and paginated/sortable maintenance queue.
  - MAC-specific endpoints return selected-device metrics and 7-day telemetry series.
- Tenant scoping behavior:
  - Admin: can request `all` or specific tenant.
  - Non-admin: resolve `organisation.name` from operations DB by `req.user.id`; allow only matching tenant name; reject mismatched tenant requests with `403`.
- Frontend integration:
  - Add reports client hook (`VITE_REPORTS_API_BASE`, default `http://localhost:5002`) that sends bearer token.
  - Replace `src/app/components/layout/filter-bar.tsx` controls with tenant/date/mac selectors + search; remove old region/tier/status/compare controls.
  - Add a shared report-filter context/provider so filter state is consistent across pages.
  - Wire `performance-report.tsx` and `maintenance-report.tsx` to `reports-api` endpoints, including loading/error states and server-driven pagination/sort.
- Dev/runtime wiring:
  - Add root scripts: `dev:reports-api`.
  - Update `scripts/dev-all.mjs` to start frontend + operations-api + reports-api.
  - Add `VITE_REPORTS_API_BASE` to root `.env.example`.
- Docs:
  - Add `REPORTS_API_CONTRACT.md` (new service contract).
  - Update `API_CONTRACT.md` with cross-service overview and pointer to reports contract.

### Test Plan
- `reports-api` unit tests:
  - JWT auth guard behavior (401/403 paths).
  - Tenant scope resolver for Admin vs non-admin and forbidden tenant requests.
  - Query-parameter validation (`tenant`, `date`, `mac`, pagination/sort).
- `reports-api` route tests:
  - Happy-path responses for each endpoint with mocked DB clients.
  - Error-path responses for invalid filters, unknown tenant mapping, and DB failures.
- Frontend tests:
  - FilterBar fetch chain: tenant change -> refresh dates -> refresh MAC options.
  - Performance/Maintenance pages render API payloads and handle loading/error states.
- Manual smoke checks:
  - Admin can switch tenants and see data changes.
  - Non-admin only sees mapped tenant and cannot force another tenant.
  - Telemetry endpoints remain responsive with selected MAC/date.

### Assumptions and Defaults
- `operations.organisation.name` maps directly (case-insensitive) to `reports.tenants.name`.
- Non-admin users map to exactly one tenant; if no mapping exists, reports return empty/forbidden responses.
- `reports-api` runs on port `5002` by default.
- Existing SQL semantics are preserved, but converted to parameterized queries and API response DTOs.
- Global FilterBar replacement is intentional across the app; only report pages will consume full filter semantics initially.
