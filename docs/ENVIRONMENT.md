# Environment Variables

Consolidated reference for every environment variable across the three apps and the Docker stack. Per-app templates: `apps/frontend/.env.example`, `apps/operations-api/.env.example`, `apps/analytics-api/.env.example`, and root `.env.example` (compose).

**Setup:** copy each `.env.example` → `.env` in the same directory. The operations-api **exits at startup** if `JWT_SECRET` or `MOBILE_API_KEY` is unset.

Legend: **Req** = required (no safe default) · default shown where the code falls back.

## Root / Docker Compose (`.env`)

Consumed by `docker-compose*.yml` for the Postgres container and image wiring.

| Variable | Req | Default | Purpose |
|---|---|---|---|
| `POSTGRES_DB` | ✓ | `frostlink` | Operational DB name |
| `POSTGRES_USER` | ✓ | `frostlink` | Operational DB user |
| `POSTGRES_PASSWORD` | ✓ | — | Operational DB password |
| `DB_ANON_ROLE` |  | `anon` | Anonymous role passed to the Postgres image |
| `DB_SCHEMA` |  | `frostlink` | Schema name |
| `TZ` |  | `Etc/UTC` | Container timezone |
| `DATABASE_PORT` |  | `5432` | Host port mapped to Postgres |
| `OPS_API_PORT` |  | `5001` | Host port for operations-api |
| `ANALYTICS_API_PORT` |  | `5002` | Host port for analytics-api |
| `CORS_ORIGIN` |  | `http://localhost:5173,http://127.0.0.1:5173` | Allowed origins (passed to APIs) |
| `NUXT_PUBLIC_OPERATIONS_API_BASE` |  | `http://localhost:5001` | Baked into frontend image build |
| `NUXT_PUBLIC_APP_MODE` |  | `online` | Frontend app mode |
| `FRONTEND_TAG` / `OPS_API_TAG` / `ANALYTICS_API_TAG` |  | `latest` | Image tags for build/pull |

UAT/prod additionally read `*_SSH_*`, `REGISTRY_*`/`BITBUCKET_PACKAGES_*`, and Traefik/Let's Encrypt settings (see `bitbucket-pipelines.yml` and the uat/prod compose files).

## Frontend — `apps/frontend/.env`

Only `NUXT_PUBLIC_*` vars are exposed to the client bundle.

| Variable | Req | Default | Purpose |
|---|---|---|---|
| `NUXT_PUBLIC_OPERATIONS_API_BASE` |  | `http://localhost:5001` | operations-api base URL (`runtimeConfig.public.operationsApiBase`) |
| `NUXT_PUBLIC_ANALYTICS_API_BASE` |  | `http://localhost:5002` | analytics-api base URL (`runtimeConfig.public.analyticsApiBase`) — set in `nuxt.config.ts`; add to `.env` to override |
| `NUXT_PUBLIC_APP_MODE` |  | `online` | App mode flag |

## operations-api — `apps/operations-api/.env`

| Variable | Req | Default | Purpose |
|---|---|---|---|
| `PORT` |  | `5001` | Listen port |
| `JWT_SECRET` | ✓ | — | **Boot-required.** Signs/verifies user JWTs |
| `MOBILE_API_KEY` | ✓ | — | **Boot-required.** `x-api-key` for `POST /mobile/verify` |
| `DATABASE_URL` | ✓ | — | Postgres URL for Prisma (`postgresql://user:pass@host:5432/frostlink`) |
| `OPS_DB_USER` |  | — | Raw `pg` pool user (used by `db.js`) |
| `OPS_DB_PASSWORD` |  | — | Raw pool password |
| `OPS_DB_HOST` |  | `localhost` | Raw pool host (normalized) |
| `OPS_DB_PORT` |  | `5432` | Raw pool port |
| `OPS_DB_NAME` |  | `frostlink` | Raw pool database |
| `CORS_ORIGIN` |  | `http://localhost:5173,http://127.0.0.1:5173` | Allowed origins |
| `APP_URL` |  | first CORS origin / `http://localhost:5173` | Base URL used in outgoing email links |
| `EMAIL_PROVIDER` |  | `smtp` | `smtp` or `ses` |
| `SMTP_HOST` |  | — (blank disables email) | SMTP server |
| `SMTP_PORT` |  | `587` | SMTP port |
| `SMTP_SECURE` |  | `false` | TLS on connect |
| `SMTP_USER` / `SMTP_PASS` |  | — | SMTP credentials |
| `SMTP_FROM` |  | — | From address (SMTP) |
| `AWS_REGION` |  | `us-east-1` | SES region (when `EMAIL_PROVIDER=ses`) |
| `SES_FROM` |  | — | From address (SES) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |  | — | SES creds; leave blank to use IAM role |
| `ANALYTICS_DB_USER/PASSWORD/HOST/PORT/NAME` |  | postgres/…/`shpmarketing_analytics` | Reserved (phase-2 integration; not actively used by operations-api) |

## analytics-api — `apps/analytics-api/.env`

| Variable | Req | Default | Purpose |
|---|---|---|---|
| `PORT` |  | `5002` | Listen port |
| `ANALYTICS_DB_USER` |  | `postgres` | Analytics DB user |
| `ANALYTICS_DB_PASSWORD` |  | `postgres` | Analytics DB password |
| `ANALYTICS_DB_HOST` |  | `localhost` | Analytics DB host (normalized; `host.docker.internal` in compose) |
| `ANALYTICS_DB_PORT` |  | `5432` | Analytics DB port |
| `ANALYTICS_DB_NAME` |  | `shpmarketing_analytics` | Analytics DB name |
| `CORS_ORIGIN` |  | (empty) | Allowed origins (comma-separated) |

## Notes

- **Never commit `.env` files.** `.gitignore` excludes `apps/*/.env*` (keeping `.env.example`).
- Secrets that must be set per environment: `JWT_SECRET`, `MOBILE_API_KEY`, DB passwords, SMTP/SES credentials. Change all defaults before any deployed environment.
- In deployed stacks, env is supplied via `apps/operations-api/.env.uat` / `.env.prod` and the compose `--env-file`; ensure these exist on the server (see deploy notes in `bitbucket-pipelines.yml`).
- See [AUTH.md](AUTH.md) for how `JWT_SECRET` / `MOBILE_API_KEY` are used.
