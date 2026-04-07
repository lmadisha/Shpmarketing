# Docker Compose Stack Guide

This guide covers the production-ready Docker Compose stack with PostgreSQL, Traefik reverse proxy, and Let's Encrypt SSL/TLS support.

## Architecture Overview

The stack consists of:
- **PostgreSQL Database** - Persistent data storage with volume mounts
- **Operations API** - Node.js Express backend
- **Frontend** - Nuxt.js frontend application  
- **Traefik** - Reverse proxy with automatic SSL/TLS via Let's Encrypt
- **Docker Network** - All services communicate via internal network

### Service Dependencies
```
Traefik (Port 80, 443, 8081)
  ├── Frontend (Port 3000 internal)
  └── API (Port 5001 internal)
      └── PostgreSQL (Port 5432 internal)
```

## Quick Start

### Local Development Stack

1. **Copy environment files:**
   ```bash
   cp .env.example .env
   cp operations-api/.env.example operations-api/.env
   ```

2. **Start the stack:**
   ```bash
   docker compose up --build
   ```
   
   The `docker-compose.override.yml` is automatically used for local development with hot-reload.

3. **Access the application:**
   - Frontend: http://localhost:5173
   - API: http://localhost:5001
   - Database: localhost:5432 (for external tools)

4. **Stop the stack:**
   ```bash
   docker compose down
   ```

### UAT Deployment (Local/Remote)

UAT mode includes Traefik with HTTPS support for SSL/TLS testing.

1. **Generate Traefik basic auth:**
   ```bash
   # Install htpasswd if needed
   # macOS: brew install httpd
   # Linux: sudo apt-get install apache2-utils
   # Windows: Use Docker or download from Apache
   
   # Generate hash for admin user
   htpasswd -B -c auth admin
   
   # Copy the hash to .env.uat as TRAEFIK_BASIC_AUTH
   ```

2. **Configure UAT domain (local testing):**
   Edit your hosts file:
   - **Windows:** `C:\Windows\System32\drivers\etc\hosts`
   - **Linux/macOS:** `/etc/hosts`
   
   Add:
   ```
   127.0.0.1 uat.frostlink.local
   ```

3. **Set environment variables:**
   ```bash
   # Copy and customize UAT environment
   cp .env.uat .env.uat  # Customize if needed
   cp operations-api/.env.uat operations-api/.env.uat
   ```

4. **Start the UAT stack:**
   ```bash
   docker compose -f docker-compose.uat.yml up --build
   ```

5. **Access the stack:**
   - Frontend: https://uat.frostlink.local (with self-signed cert initially)
   - API: https://uat.frostlink.local/api
   - Traefik Dashboard: https://uat.frostlink.local:8081/dashboard (user: admin, password: admin)
   
6. **Stop the UAT stack:**
   ```bash
   docker compose -f docker-compose.uat.yml down
   ```

### Production Deployment

⚠️ **Production setup requires:**
- Real domain name with DNS
- Real email for Let's Encrypt
- Strong, unique passwords
- Proper secrets management

**Steps:**

1. **Create production environment file:**
   ```bash
   cp .env.prod .env.prod.local  # DO NOT commit .env.prod.local
   ```

2. **Set production secrets:**
   ```bash
   # Generate strong database password
   openssl rand -base64 32 > /tmp/db_pass.txt
   
   # Generate strong JWT secret
   openssl rand -base64 32 > /tmp/jwt_secret.txt
   
   # Generate strong Mobile API key
   openssl rand -base64 32 > /tmp/api_key.txt
   
   # Generate Traefik basic auth
   htpasswd -B -c auth admin-user
   ```

3. **Update .env.prod.local with secrets:**
   ```bash
   DATABASE_PASSWORD=<from /tmp/db_pass.txt>
   DATABASE_USER=frostlink_prod
   PROD_DOMAIN=app.frostlink.com
   LETSENCRYPT_EMAIL=ops@frostlink.com
   JWT_SECRET=<from /tmp/jwt_secret.txt>
   MOBILE_API_KEY=<from /tmp/api_key.txt>
   TRAEFIK_BASIC_AUTH=<from htpasswd output>
   ```

4. **Update operations-api/.env.prod:**
   ```bash
   # Set the same secrets as above
   JWT_SECRET=<same as .env.prod.local>
   MOBILE_API_KEY=<same as .env.prod.local>
   ```

5. **Ensure DNS is configured:**
   - Point `app.frostlink.com` to your production server IP
   - Wait for DNS propagation (can take up to 24 hours)

6. **Deploy to production server:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

7. **Verify deployment:**
   ```bash
   # Check all services are running
   docker compose -f docker-compose.prod.yml ps
   
   # View logs
   docker compose -f docker-compose.prod.yml logs -f
   
   # Check Traefik dashboard
   https://app.frostlink.com/dashboard (with credentials)
   
   # Access the application
   https://app.frostlink.com
   ```

8. **Stop production stack (for maintenance):**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

## Database Management

### Initialize Database

The PostgreSQL container automatically runs `database_details/schema.sql` on first startup.

### Backup Database

```bash
# Local development backup
docker compose exec postgres pg_dump -U frostlink frostlink > backup.sql

# UAT backup
docker compose -f docker-compose.uat.yml exec postgres pg_dump -U frostlink frostlink > backup-uat.sql

# Production backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U frostlink_prod frostlink_prod > backup-prod.sql
```

### Restore Database

```bash
# Local restore
docker compose exec -T postgres psql -U frostlink frostlink < backup.sql

# UAT restore
docker compose -f docker-compose.uat.yml exec -T postgres psql -U frostlink frostlink < backup-uat.sql

# Production restore
docker compose -f docker-compose.prod.yml exec -T postgres psql -U frostlink_prod frostlink_prod < backup-prod.sql
```

### Direct Database Access

```bash
# Local development
psql postgresql://frostlink:frostlink-dev-password@localhost:5432/frostlink

# UAT (from within Docker network)
docker compose -f docker-compose.uat.yml exec postgres psql -U frostlink -d frostlink

# Production (from within Docker network)
docker compose -f docker-compose.prod.yml exec postgres psql -U frostlink_prod -d frostlink_prod
```

## Troubleshooting

### Services won't start

**Check logs:**
```bash
# Local
docker compose logs -f

# Specific service (local)
docker compose logs -f operations-api

# UAT
docker compose -f docker-compose.uat.yml logs -f postgres

# Production
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Database connection issues

```bash
# Verify database is healthy
docker compose ps postgres
# Status should be "healthy" after 30 seconds

# Check database logs
docker compose logs postgres

# Test connection manually
docker compose exec postgres psql -U frostlink -d frostlink -c "SELECT 1"
```

### SSL/TLS certificate issues (UAT/Prod)

```bash
# Check Let's Encrypt setup (Traefik container must have internet access)
docker compose -f docker-compose.uat.yml logs traefik

# Verify ACME storage
docker compose -f docker-compose.uat.yml exec traefik ls -la /letsencrypt/

# For local testing with self-signed certificates, browsers will warn - this is normal
```

### API can't connect to database

1. Verify `DATABASE_URL` environment variable
2. Ensure Traefik hasn't started yet if using `docker compose up` (services start in dependency order)
3. Check if PostgreSQL health check is passing: `docker compose ps postgres`
4. Verify credentials match between `.env` files and database configuration

### Container resource issues

```bash
# Check resource usage
docker stats

# View container details
docker compose ps

# Rebuild images without cache if stuck
docker compose build --no-cache
```

## Advanced Configuration

### Custom Traefik Configuration

Edit the `traefik` service definition in the appropriate compose file to:
- Add middleware (rate limiting, compression, etc.)
- Configure additional entrypoints
- Set custom log levels
- Add routing rules

### Database Backups Strategy

For production, implement automated backups:
```bash
# Example: Daily backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U frostlink_prod frostlink_prod | \
  gzip > "$BACKUP_DIR/backup-$DATE.sql.gz"
```

### SSL/TLS Certificate Management

Traefik automatically manages Let's Encrypt certificates:
- Stores in `/letsencrypt/acme.json` within the Traefik container
- Automatically renews before expiration
- Accessible via persistent volume

To access certificate files directly:
```bash
docker compose exec traefik ls -la /letsencrypt/
```

## Health Checks

All services include health checks:
- **PostgreSQL:** `pg_isready` command, 10s interval, retries after 5s
- **Operations API:** HTTP health endpoint check, 10s interval
- **Frontend:** Runs standard Nuxt.js health

View health status:
```bash
docker compose ps
# Status column shows "healthy", "starting", or "unhealthy"
```

## Environment Variable Reference

### Common Variables (all environments)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_USER` | `frostlink` | PostgreSQL username |
| `DATABASE_PASSWORD` | See `.env*` | PostgreSQL password |
| `DATABASE_NAME` | `frostlink` | PostgreSQL database name |
| `OPS_API_PORT` | `5001` | API port |

### Frontend Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NUXT_PUBLIC_OPERATIONS_API_BASE` | `/api` (prod) or `http://localhost:5001` (dev) | API endpoint URL |
| `NUXT_PUBLIC_APP_MODE` | `online` | Application mode |

### API Variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Authentication token signing secret |
| `MOBILE_API_KEY` | Mobile application API key |
| `CORS_ORIGIN` | Allowed request origins |

### Traefik Variables (UAT/Prod)

| Variable | Purpose |
|----------|---------|
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt certificate notifications |
| `TRAEFIK_LOG_LEVEL` | Traefik logging level (DEBUG, INFO, WARN, ERROR) |
| `TRAEFIK_BASIC_AUTH` | Dashboard basic auth credentials |

## Security Recommendations

1. **Change all default passwords** before production deployment
2. **Use strong, unique passwords** (min 16 characters, mixed character types)
3. **Keep `.env.prod*` files out of version control**
4. **Regularly update base images** (PostgreSQL, Node, Traefik)
5. **Use secrets management** for production (Docker Secrets, HashiCorp Vault, AWS Secrets Manager, etc.)
6. **Enable database replication/backup** before production
7. **Monitor logs** for security issues
8. **Restrict API access** via CORS and rate limiting
9. **Use strong Let's Encrypt email** for certificate recovery
10. **Rotate secrets periodically** (especially JWT_SECRET and API keys)

## Next Steps

- [ ] Test local stack thoroughly
- [ ] Configure UAT domain and network
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Document your deployment procedure
- [ ] Set up CI/CD pipeline to build and push images
- [ ] Plan database migration strategy
- [ ] Establish incident response procedures
