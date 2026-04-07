# Docker Deployment Guide - Production Ready Stack

This repository has been updated with a **production-ready Docker stack** that includes:

- **PostgreSQL** with persistent volume storage
- **Self-contained services** communicating via Docker network
- **Traefik reverse proxy** with automatic SSL/TLS via Let's Encrypt
- **Environment-specific compose files** for local, UAT, and production
- **Health checks** for all services

## Quick Start Guide

### Local Development (with hot-reload)

```bash
# 1. Set up environment
cp .env.example .env
cp operations-api/.env.example operations-api/.env

# 2. Start the full stack with PostgreSQL
docker compose up --build

# 3. Access services
# - Frontend: http://localhost:5173
# - API: http://localhost:5001
# - Database: localhost:5432
```

The `docker-compose.override.yml` is automatically used for local development, providing hot-reload capabilities for both frontend and API.

### UAT Deployment (Local or Remote)

```bash
# 1. Set up UAT environment
cp .env.uat .env.uat.local
cp operations-api/.env.uat operations-api/.env.uat.local
# Edit values in .env.uat.local and operations-api/.env.uat.local

# 2. Add domain to hosts file (for local testing)
# Windows: C:\Windows\System32\drivers\etc\hosts
# Linux/macOS: /etc/hosts
# 127.0.0.1 uat.frostlink.local

# 3. Start UAT stack with Traefik and HTTPS
docker compose -f docker-compose.uat.yml up --build

# 4. Access
# - Frontend: https://uat.frostlink.local
# - API: https://uat.frostlink.local/api
# - Traefik Dashboard: https://uat.frostlink.local:8081/dashboard
```

### Production Deployment

```bash
# 1. Configure environment with REAL secrets
cp .env.prod .env.prod.local
# Edit with strong passwords, real domain, Let's Encrypt email, etc.

# 2. Deploy
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verify
docker compose -f docker-compose.prod.yml ps
```

## Environment Files

### Root `.env` (Local Development)
```bash
NUXT_PUBLIC_OPERATIONS_API_BASE=http://localhost:5001
NUXT_PUBLIC_APP_MODE=online
DATABASE_USER=frostlink
DATABASE_PASSWORD=frostlink-dev-password
DATABASE_NAME=frostlink


## Architecture

### Docker Network
All services communicate via an internal Docker network called `frostlink`:
- **frontend** ↔ **operations-api** ↔ **postgres**
- **traefik** (UAT/Prod) routes external requests

### Service Health Checks
- **PostgreSQL:** `pg_isready` check every 10s
- *Database Management

### Backup
```bash
# Local development
docker compose exec postgres pg_dump -U frostlink frostlink > backup.sql

# Production
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U frostlink_prod frostlink_prod > backup-prod.sql
```

### Restore
```bash
# Local development
docker compose exec -T postgres psql -U frostlink frostlink < backup.sql
```

### Direct Access
```bash
# Local
docker compose exec postgres psql -U frostlink -d frostlink

# Production
docker compose -f docker-compose.prod.yml exec postgres psql -U frostlink_prod -d frostlink_prod
```

## Compose Files Reference

| File | Purpose | Services | Networks |
|------|---------|----------|----------|
| `docker-compose.yml` | Local development with hot-reload | PostgreSQL + API + Frontend | Internal only |
| `docker-compose.override.yml` | Development overrides (auto-used) | Volume mounts for hot-reload | Extends base |
| `docker-compose.uat.yml` | UAT with Traefik + HTTPS | PostgreSQL + API + Frontend + Traefik | Internal + Traefik |
| `docker-compose.prod.yml` | Production with Traefik + HTTPS | PostgreSQL + API + Frontend + Traefik | Internal + Traefik |
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

### Local Development
```bash
# Start fresh
docker compose down -v
docker compose up --build

# View logs
docker compose logs -f
docker compose logs -f operations-api
docker compose logs -f postgres

# Rebuild services
docker compose build operations-api
docker compose build --no-cache

# Render final config
docker compose config
```

### UAT
```bash
# Start UAT stack
docker compose -f docker-compose.uat.yml up -d --build

# View logs
docker compose -f docker-compose.uat.yml logs -f
docker compose -f docker-compose.uat.yml logs -f traefik

# Stop UAT
docker compose -f docker-compose.uat.yml down

# View running services
docker compose -f docker-compose.uat.yml ps
```

### Production
```bash
# Start production (background)
docker compose -f docker-compose.prod.yml up -d --build

# Monitor logs
docker compose -f docker-compose.prod.yml logs -f

# Stop production
docker compose -f docker-compose.prod.yml down

# View service status
docker compose -f docker-compose.prod.yml ps

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f operations-api
docker compose -f docker-compose.prod.yml logs -f traefik
```

## Troubleshooting

### Services fail to start

1. **Check logs first:**
   ```bash
   docker compose logs postgres
   docker compose logs operations-api
   ```

2. **Verify ports are available:**
   ```bash
   # Windows
   netstat -an | findstr "5173\|5001\|5432\|80\|443"
   
   # Linux/macOS
   lsof -i :5173,5001,5432,80,443
   ```

3. **Clean and restart:**
   ```bash
   docker compose down -v
   docker compose up --build
   ```

### Database won't connect

1. **Check PostgreSQL is running:**
   ```bash
   docker compose ps postgres
   # Status should show "healthy" after ~30 seconds
   ```

2. **Verify health check:**
   ```bash
   docker compose exec postgres pg_isready -U frostlink
   ```

3. **Check logs:**
   ```bash
   docker compose logs postgres
   ```

### API can't reach database

1. **Verify environment variables:**
   ```bash
   docker compose exec operations-api env | grep OPS_DB
   docker compose exec operations-api env | grep DATABASE_URL
   ```

2. **Test connection from API container:**
   ```bash
   docker compose exec operations-api psql postgresql://frostlink:frostlink-dev-password@postgres:5432/frostlink
   ```

### Traefik SSL/TLS issues (UAT/Prod)

1. **Check Let's Encrypt setup:**
   ```bash
   docker compose -f docker-compose.uat.yml logs traefik
   ```

2. **Verify domain resolution:**
   ```bash
   # Windows
   nslookup uat.frostlink.local
   
   # Linux/macOS
   dig uat.frostlink.local
   ```

3. **Check certificate storage:**
   ```bash
   docker compose -f docker-compose.uat.yml exec traefik ls -la /letsencrypt/
   ```

### Container resource issues

```bash
# Check resource usage
docker stats

# View container details
docker ps -a

# Free up resources
docker system prune -a
docker volume prune
```

## Migration from Old Setup

If moving from an existing PostgreSQL instance:

1. **Backup old database:**
   ```bash
   pg_dump -U <old_user> -h <old_host> <old_db> > old_backup.sql
   ```

2. **Start new stack:**
   ```bash
   docker compose up --build
   ```

3. **Restore to new database:**
   ```bash
   docker compose exec -T postgres psql -U frostlink -d frostlink < old_backup.sql
   ```

4. **Verify data:**
   ```bash
   docker compose exec postgres psql -U frostlink -d frostlink -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
   ```

## Performance Tips

- **Development:** Local volumes + hot-reload enabled by default
- **UAT:** Use persistent volumes for data retention between restarts
- **Production:** Monitor Docker stats and consider resource limits
- **Database:** Place `postgres_data_*` volumes on fast storage (SSD preferred)
- **Backups:** Schedule regular automated backups before production use

## Security Best Practices

- ✅ Change all default passwords (`.env.prod` and `operations-api/.env.prod`)
- ✅ Use strong passwords (min 16 chars, mixed types)
- ✅ Don't commit production `.env.prod` or `.env.prod.local` files
- ✅ Use Docker secrets for true production deployments
- ✅ Enable database backups and replication
- ✅ Rotate JWT_SECRET and MOBILE_API_KEY periodically
- ✅ Monitor all activity via Traefik dashboard
- ✅ Update base images regularly (`docker pull postgres:15-bookworm`)

## Next Steps

1. **Test locally:** Run `docker compose up` and verify all services
2. **Try UAT:** Deploy to UAT server with real domain
3. **Production ready:** When satisfied, promote to production
4. **Monitoring:** Set up centralized logging and metrics
5. **CI/CD:** Automate building and pushing images to registry
6. **Backups:** Implement automated database backup strategy

## Additional Resources

- See `DOCKER_COMPOSE_GUIDE.md` for detailed advanced configuration
- PostgreSQL docs: https://www.postgresql.org/docs/15/
- Traefik docs: https://doc.traefik.io/traefik/
- Docker Compose docs: https://docs.docker.com/compose/
