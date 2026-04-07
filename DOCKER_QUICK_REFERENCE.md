# Docker Quick Reference

## Quick Start

```bash
# Clone repo
git clone <repo-url>
cd frostlink

# Setup
cp .env.example .env
cp operations-api/.env.example operations-api/.env

# Start everything
docker compose up

# Access
# Frontend: http://localhost:5173
# API: http://localhost:5001
```

## Essential Commands

### Local Development

| Command | Purpose |
|---------|---------|
| `docker compose up` | Start all services with hot-reload |
| `docker compose up -d` | Start in background |
| `docker compose down` | Stop all services |
| `docker compose down -v` | Stop and remove data (fresh start) |
| `docker compose logs -f` | View live logs |
| `docker compose ps` | View running services |
| `docker compose build --no-cache` | Rebuild without cache |

### Database

| Command | Purpose |
|---------|---------|
| `docker compose exec postgres psql -U frostlink -d frostlink` | Open database console |
| `docker compose exec postgres pg_dump -U frostlink frostlink > backup.sql` | Backup database |
| `docker compose exec -T postgres psql -U frostlink frostlink < backup.sql` | Restore database |
| `docker compose logs postgres` | View database logs |

### Services

| Command | Purpose |
|---------|---------|
| `docker compose logs -f operations-api` | View API logs |
| `docker compose logs -f frontend` | View Frontend logs |
| `docker compose exec operations-api npm test` | Run API tests |
| `docker compose stop operations-api` | Stop specific service |
| `docker compose restart operations-api` | Restart service |

### UAT

| Command | Purpose |
|---------|---------|
| `docker compose -f docker-compose.uat.yml up -d --build` | Start UAT stack |
| `docker compose -f docker-compose.uat.yml down` | Stop UAT |
| `docker compose -f docker-compose.uat.yml logs -f traefik` | View Traefik logs |

### Production

| Command | Purpose |
|---------|---------|
| `docker compose -f docker-compose.prod.yml up -d --build` | Start production |
| `docker compose -f docker-compose.prod.yml down` | Stop production |
| `docker compose -f docker-compose.prod.yml ps` | View production services |
| `docker compose -f docker-compose.prod.yml logs -f` | View production logs |

## Port Reference

| Port | Service | Environment |
|------|---------|-------------|
| 5173 | Frontend | Local dev only |
| 5001 | API | Local dev only |
| 5432 | PostgreSQL | Local only |
| 80 | Traefik (HTTP redirect) | UAT, Prod |
| 443 | Traefik (HTTPS) | UAT, Prod |
| 8081 | Traefik Dashboard | UAT only |

## Environment Variables

### Quick Reference

**Local `.env`:**
```bash
DATABASE_USER=frostlink
DATABASE_PASSWORD=frostlink-dev-password
DATABASE_NAME=frostlink
NUXT_PUBLIC_OPERATIONS_API_BASE=http://localhost:5001
```

**Local `operations-api/.env`:**
```bash
OPS_DB_USER=frostlink
OPS_DB_PASSWORD=frostlink-dev-password
OPS_DB_HOST=postgres
OPS_DB_PORT=5432
DATABASE_URL=postgresql://frostlink:frostlink-dev-password@postgres:5432/frostlink
JWT_SECRET=dev-only-change-this
MOBILE_API_KEY=dev-only-change-this
```

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Port 5173 already in use | `netstat -an \| findstr 5173` → kill process |
| Database won't connect | `docker compose ps postgres` → check "healthy" |
| Services won't start | `docker compose down -v` → `docker compose up --build` |
| Out of disk space | `docker system prune -a` |
| Slow performance | Increase Docker RAM in Settings |
| Changes not reflecting | `docker compose restart <service>` |

## File Structure

```
.
├── docker-compose.yml              ← Local dev (with PostgreSQL)
├── docker-compose.override.yml     ← Dev overrides (auto-used)
├── docker-compose.uat.yml          ← UAT with Traefik
├── docker-compose.prod.yml         ← Production with Traefik
├── .env.example                    ← Template for .env
├── .env.uat                        ← UAT environment
├── .env.prod                       ← Production environment
├── DOCKER_DEPLOYMENT.md            ← Main deployment guide
├── DOCKER_COMPOSE_GUIDE.md         ← Advanced configuration
├── DEVELOPMENT_WORKFLOW.md         ← Development guide
├── DEPLOYMENT_CHECKLIST.md         ← Pre-deployment checklist
├── Dockerfile                      ← Frontend build
└── operations-api/
    ├── Dockerfile                  ← API build
    ├── .env.example                ← Template for API .env
    ├── .env.uat                    ← UAT API config
    └── .env.prod                   ← Production API config
```

## Key File Changes

### What's New

✅ Integrated PostgreSQL in docker-compose.yml  
✅ Added docker-compose.override.yml for hot-reload  
✅ Created docker-compose.uat.yml with Traefik + HTTPS  
✅ Updated docker-compose.prod.yml with full Traefik setup  
✅ Created environment-specific .env files  
✅ Added comprehensive documentation  

### What Changed

- Docker network now internal (services don't expose all ports)
- Database is now included in compose (no external setup needed)
- All services dependencies are explicit
- Health checks added for all services
- Traefik handles routing and SSL/TLS

## Getting Help

1. **Check logs:**
   ```bash
   docker compose logs <service-name>
   ```

2. **Read the guides:**
   - `DEVELOPMENT_WORKFLOW.md` - For daily development
   - `DOCKER_DEPLOYMENT.md` - For deployment process
   - `DOCKER_COMPOSE_GUIDE.md` - For advanced config

3. **Test in isolation:**
   ```bash
   docker compose restart <service>
   docker compose logs -f <service>
   ```

4. **Fresh start:**
   ```bash
   docker compose down -v
   docker compose up --build
   ```

## Security Reminders

⚠️ **NEVER commit:**
- `.env.prod` or `.env.prod.local`
- `operations-api/.env.prod` or `.env.prod.local`
- Any file containing passwords or secrets

✅ **DO:**
- Use `.env.example` templates
- Generate strong passwords with `openssl rand -base64 32`
- Rotate secrets periodically
- Keep backups secure
- Use Docker secrets for true production setups
