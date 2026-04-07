# Docker Deployment Instructions

This guide explains how to run the ShpMarketing frontend, operations API, and PostgreSQL database with Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Ports `5173`, `5001`, and `5433` available on your machine

## Environment Files

Docker Compose reads configuration from two files:

- Root `.env` for frontend runtime values
- `operations-api/.env` for API and database values

### Root `.env`

```bash
NUXT_PUBLIC_OPERATIONS_API_BASE=http://localhost:5001
NUXT_PUBLIC_APP_MODE=online
```

### `operations-api/.env`

```bash
PORT=5001
OPS_DB_USER=postgres
OPS_DB_PASSWORD=postgres
OPS_DB_HOST=localhost
OPS_DB_PORT=5433
OPS_DB_NAME=postgres
JWT_SECRET=your-secure-jwt-secret-here
MOBILE_API_KEY=your-mobile-api-key-here
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
```

Compose uses `operations-api/.env` as the source of truth for database credentials and name. Inside the Docker network, the API automatically connects to the internal `postgres` service on port `5432`.

## Start The Stack

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d --build
```

## Service URLs

- Frontend: `http://localhost:5173`
- Operations API: `http://localhost:5001`
- PostgreSQL: `localhost:5433`

## Useful Commands

Start a single service:

```bash
docker compose up operations-api --build
```

View logs:

```bash
docker compose logs
docker compose logs -f frontend
docker compose logs -f operations-api
docker compose logs -f postgres
```

Stop everything:

```bash
docker compose down
```

Stop and remove the database volume:

```bash
docker compose down -v
```

## Service Notes

### Frontend

- Built from `Dockerfile`
- Exposed on port `5173`
- Uses root `.env`

### Operations API

- Built from `operations-api/Dockerfile`
- Exposed on port `5001`
- Uses `operations-api/.env`
- Waits for PostgreSQL health before starting

### PostgreSQL

- Uses `postgres:15`
- Exposed on host port `5433`
- Initializes schema from `operations-api/schema.sql`
- Persists data in the `postgres_data` volume

## Troubleshooting

Check for port conflicts:

```bash
netstat -an | findstr "5173\|5001\|5433"  # Windows
lsof -i :5173,5001,5433                   # Linux/macOS
```

Inspect the rendered Compose config:

```bash
docker compose config
```

Open a PostgreSQL shell:

```bash
docker compose exec postgres psql -U postgres -d postgres
```

If you change frontend env values such as `NUXT_PUBLIC_OPERATIONS_API_BASE`, rebuild the frontend image:

```bash
docker compose up --build
```
