# Docker Deployment Instructions

This repository ships two Compose files:

- `docker-compose.yml` for the main local/containerized app setup
- `docker-compose.prod.yml` for production-style deployment behind `/api`

Neither file starts PostgreSQL anymore. The API connects to an existing database using values from `operations-api/.env`.

## Prerequisites

- Docker Desktop or Docker Engine with Compose
- An existing PostgreSQL server already running
- Ports available:
  - `5173` for the local frontend compose file
  - `5001` for the API
  - `8080` for the production-style frontend compose file

## Environment Files

### Root `.env`

Used by the frontend build/runtime.

```bash
NUXT_PUBLIC_OPERATIONS_API_BASE=http://localhost:5001
NUXT_PUBLIC_APP_MODE=online
```

### `operations-api/.env`

Used by the API container.

```bash
PORT=5001
OPS_DB_USER=postgres
OPS_DB_PASSWORD=postgres
OPS_DB_HOST=host.docker.internal
OPS_DB_PORT=5433
OPS_DB_NAME=postgres
JWT_SECRET=your-secure-jwt-secret-here
MOBILE_API_KEY=your-mobile-api-key-here
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5433/postgres
```

## Important Networking Note

If the API runs inside Docker and your database runs on the host machine, do not use `localhost` for the database host.

- Inside a container, `localhost` means the container itself
- Use `host.docker.internal` to connect from the container to a database running on the Docker host

That means these two values usually need to agree:

```bash
OPS_DB_HOST=host.docker.internal
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5433/postgres
```

## What The API Uses For DB Connection

There are two database config paths in the API:

- Prisma uses `DATABASE_URL`
- The raw `pg` helper uses `OPS_DB_USER`, `OPS_DB_PASSWORD`, `OPS_DB_HOST`, `OPS_DB_PORT`, and `OPS_DB_NAME`

The current API entrypoint uses Prisma, so `DATABASE_URL` is the most important setting for actual runtime DB access.

On startup, the API logs the loaded DB env summary from `operations-api/env.js`, including:

- `OPS_DB_USER`
- `OPS_DB_HOST`
- `OPS_DB_PORT`
- `OPS_DB_NAME`
- parsed `DATABASE_URL` target

## Local Compose

Start the local stack:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d --build
```

Service URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:5001`

This file:

- builds the frontend from `Dockerfile`
- builds the API from `operations-api/Dockerfile`
- loads API env from `operations-api/.env`
- does not start PostgreSQL

## Production Compose

Start the production-style stack:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Run in the background:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Service URLs:

- Frontend: `http://localhost:8080`
- API: `http://localhost:5001`

This file:

- builds the frontend with `NUXT_PUBLIC_OPERATIONS_API_BASE=/api`
- loads API env from both `.env` and `operations-api/.env`
- does not start PostgreSQL

## Useful Commands

Rebuild only the API image:

```bash
docker compose build operations-api
docker compose up -d --no-deps operations-api
```

Rebuild only the API image with production compose:

```bash
docker compose -f docker-compose.prod.yml build operations-api
docker compose -f docker-compose.prod.yml up -d --no-deps operations-api
```

View logs:

```bash
docker compose logs -f operations-api
docker compose logs -f frontend
```

View production logs:

```bash
docker compose -f docker-compose.prod.yml logs -f operations-api
docker compose -f docker-compose.prod.yml logs -f frontend
```

Render the effective Compose config:

```bash
docker compose config
docker compose -f docker-compose.prod.yml config
```

Stop the stack:

```bash
docker compose down
docker compose -f docker-compose.prod.yml down
```

## Troubleshooting

Check container port conflicts:

```bash
netstat -an | findstr "5173\|5001\|8080"  # Windows
lsof -i :5173,5001,8080                   # Linux/macOS
```

If the API starts but cannot reach the database:

1. Check the startup log line beginning with `[ops-db] Loaded database env:`
2. Confirm `DATABASE_URL` points at the correct host and port
3. If the DB is on the host machine, switch `localhost` to `host.docker.internal`
4. Confirm PostgreSQL allows TCP connections from Docker

If you change any Dockerfile or dependency related to the API runtime, rebuild the API image:

```bash
docker compose build operations-api
docker compose up -d --no-deps operations-api
```
