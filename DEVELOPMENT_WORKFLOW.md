# Development Workflow Guide

This guide explains how to work with the updated Docker setup during development.

## Daily Development Workflow

### Starting Development

```bash
# 1. Navigate to project
cd /path/to/frostlink

# 2. Ensure .env files exist
cp .env.example .env  # if needed
cp operations-api/.env.example operations-api/.env  # if needed

# 3. Start the stack (PostgreSQL + API + Frontend)
docker compose up

# 4. View logs to confirm everything started
# Services should reach "healthy" state after ~30 seconds
```

### What's Running

- **Frontend** on `http://localhost:5173` - Frontend app (with hot-reload)
- **API** on `http://localhost:5001` - Backend REST API (with auto-restart)
- **PostgreSQL** on `localhost:5432` - Database

### Hot-Reload Development

The `docker-compose.override.yml` automatically mounts your code directories as volumes:

**Frontend changes** (Nuxt.js):
- Edit files in `./` directory
- Changes automatically trigger Nuxt rebuild
- Browser auto-refresh (usually)
- No need to restart container

**API changes** (Express.js):
- Edit files in `./operations-api` directory
- Changes trigger Node.js auto-restart (via nodemon or similar)
- Re-test API endpoints
- No need to rebuild image

### Stopping Development

```bash
# Stop all services (data preserved in volumes)
docker compose down

# Stop and remove all data (fresh start next time)
docker compose down -v

# Stop specific service without shutting down others
docker compose stop operations-api
```

## Database Development

### Access Database Directly

```bash
# Open psql console inside database container
docker compose exec postgres psql -U frostlink -d frostlink

# Run SQL directly
docker compose exec postgres psql -U frostlink -d frostlink -c "SELECT * FROM users LIMIT 5;"

# Import SQL from file
docker compose exec -T postgres psql -U frostlink -d frostlink < schema.sql
```

### View/Modify Schema

```bash
# Dump current schema
docker compose exec postgres pg_dump -U frostlink -d frostlink --schema-only > schema_dump.sql

# Full backup
docker compose exec postgres pg_dump -U frostlink -d frostlink > backup.sql

# Restore from backup
docker compose exec -T postgres psql -U frostlink -d frostlink < backup.sql
```

### Database Troubleshooting

```bash
# Check if database is responding
docker compose exec postgres pg_isready -U frostlink

# View PostgreSQL logs
docker compose logs postgres

# Check database size
docker compose exec postgres psql -U frostlink -d frostlink -c "SELECT pg_size_pretty(pg_database_size('frostlink'));"
```

## API Development

### Viewing API Logs

```bash
# Tail live logs
docker compose logs -f operations-api

# Last 50 lines
docker compose logs --tail=50 operations-api

# With timestamps
docker compose logs -f --timestamps operations-api
```

### Testing API Endpoints

```bash
# Using curl
curl http://localhost:5001/api/endpoint

# Using curl with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/endpoint

# POST request
curl -X POST http://localhost:5001/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### API Development Commands

```bash
# Don't need to rebuild on code changes - auto-restart works
# But if you need to rebuild manually:
docker compose build operations-api
docker compose up -d operations-api

# Run API tests (from container)
docker compose exec operations-api npm test

# Lint API code
docker compose exec operations-api npm run lint
```

## Frontend Development

### Viewing Frontend Logs

```bash
# Tail live logs
docker compose logs -f frontend

# Check build errors
docker compose logs --tail=100 frontend
```

### Frontend Development Commands

```bash
# Don't need to rebuild on code changes - hot-reload is automatic
# But if needed to rebuild:
docker compose build frontend
docker compose up -d frontend

# Format code
docker compose exec frontend npm run lint

# Run frontend tests
docker compose exec frontend npm test
```

### Accessing Frontend

- Main app: `http://localhost:5173`
- Browser DevTools: F12 for console, network, etc.
- Hot-reload debug: Check browser console if HMR issues occur

## Debugging

### View All Logs Together

```bash
# All services
docker compose logs -f

# Follow specific service
docker compose logs -f operations-api

# Show last N lines
docker compose logs --tail=50
```

### Inspect Container State

```bash
# List all running containers
docker compose ps

# Connect to running container shell
docker compose exec operations-api /bin/bash
docker compose exec frontend /bin/sh

# View environment variables in container
docker compose exec operations-api env
```

### Network Debugging

```bash
# Verify services can communicate (from API container)
docker compose exec operations-api curl postgres:5432
docker compose exec operations-api curl http://frontend:5173

# Check DNS resolution
docker compose exec operations-api nslookup postgres

# View network
docker network inspect frostlink
```

## Working with Volumes

### View Volume Contents

```bash
# List all volumes
docker volume ls

# Inspect volume
docker volume inspect frostlink_postgres_data

# View volume contents
docker run --rm -v frostlink_postgres_data:/data -it postgres:15 ls -la /data
```

### Backup Volumes

```bash
# Backup database volume
docker run --rm -v frostlink_postgres_data:/data -v $(pwd):/backup \
  postgres:15 pg_dump -U frostlink -h /data frostlink > backup.sql
```

## Common Development Tasks

### Reset Everything (Fresh Start)

```bash
# Remove all containers, volumes, and networks
docker compose down -v

# Start fresh
docker compose up
```

### Rebuild All Images

```bash
# Rebuild without cache
docker compose build --no-cache

# Start updated stack
docker compose up
```

### Change Environment Variables

1. Edit `.env` or `operations-api/.env`
2. Restart the affected service:
   ```bash
   docker compose down
   docker compose up
   ```
   Or for specific service:
   ```bash
   docker compose up -d operations-api
   ```

### Update Dependencies

```bash
# Install new npm packages
docker compose exec operations-api npm install <package-name>
docker compose exec frontend npm install <package-name>

# Update existing packages
docker compose exec operations-api npm update
docker compose exec frontend npm update
```

## Performance Tips

### Monitor Resource Usage

```bash
# Real-time stats
docker stats

# Check container details
docker ps -a

# View disk usage
docker system df
```

### Optimize Development

- Keep container logs clean: `docker compose logs --tail=0 -f`
- Use `.dockerignore` to exclude unnecessary files
- Keep node_modules outside docker volumes when possible (use volume mounts)
- For slow builds, increase Docker memory allocation in Docker Desktop settings

## Troubleshooting Development Issues

### Port Already in Use

```bash
# Windows
netstat -an | findstr "5173\|5001\|5432"

# Linux/macOS
lsof -i :5173,5001,5432
```

Kill the conflicting process or use different ports.

### Container Won't Start

```bash
# Check logs
docker compose logs <service_name>

# Try rebuilding
docker compose build --no-cache <service_name>

# Full restart
docker compose down -v
docker compose up --build
```

### "Cannot connect to database"

```bash
# Verify PostgreSQL is healthy
docker compose ps postgres
# Status should be "healthy"

# Check it's running
docker compose exec postgres pg_isready -U frostlink

# View PostgreSQL logs
docker compose logs postgres
```

### Slow Performance

1. Check available Docker resources: Docker Desktop Settings → Resources
2. Increase allocated CPU/RAM if needed
3. Check system resource usage: `docker stats`
4. Place volumes on fast storage (SSD)
5. Don't store large files in volumes

## Useful Aliases

Add these to your shell config (`.bashrc`, `.zshrc`, etc.):

```bash
# Start stack
alias frostlink-dev='docker compose up'

# View logs
alias frostlink-logs='docker compose logs -f'

# Enter database
alias frostlink-db='docker compose exec postgres psql -U frostlink -d frostlink'

# Enter API shell
alias frostlink-api-shell='docker compose exec operations-api /bin/bash'

# Clean everything
alias frostlink-clean='docker compose down -v'

# Full restart
alias frostlink-restart='docker compose down -v && docker compose up --build'
```

## Next Steps

- Read the main [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for deployment info
- See [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md) for advanced configuration
- Check [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) before going to production
