# Docker Deployment Instructions

This guide explains how to run the ShpMarketing application using Docker Compose, which includes the frontend, operations API, and PostgreSQL database.

## Prerequisites

- Docker installed and running
- Docker Compose installed (usually included with Docker Desktop)
- At least 4GB of available RAM
- Ports 5173, 5001, and 5433 available on your machine

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd Shpmarketing
   ```

2. **Start all services**:
   ```bash
   docker-compose up
   ```

3. **Access the application**:
   - Frontend: http://localhost:5173
   - Operations API: http://localhost:5001
   - Database: localhost:5433 (PostgreSQL)

## Detailed Setup

### Environment Configuration

The application uses environment variables from `.env` files. The Docker Compose setup will automatically use:

- Root `.env` for frontend configuration
- `operations-api/.env` for API and database configuration

If these files don't exist, create them with the required variables (see below).

### Required Environment Variables

#### Root `.env` (Frontend)
```bash
NUXT_PUBLIC_OPERATIONS_API_BASE=http://localhost:5001
NUXT_PUBLIC_APP_MODE=online
```

#### operations-api/.env (API & Database)
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
```

### Docker Compose Commands

#### Start Services
```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# Start specific service
docker-compose up operations-api
```

#### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

#### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs operations-api

# Follow logs
docker-compose logs -f frontend
```

#### Rebuild Services
```bash
# Rebuild after code changes
docker-compose build

# Rebuild and restart
docker-compose up --build
```

## Service Architecture

### PostgreSQL Database
- **Image**: postgres:15
- **Port**: 5433 (host) → 5432 (container)
- **Database**: postgres
- **Credentials**: postgres/postgres
- **Data**: Persisted in `postgres_data` volume
- **Initialization**: Runs `schema.sql` on first startup

### Operations API
- **Port**: 5001
- **Dependencies**: Waits for PostgreSQL to be healthy
- **Environment**: Uses `operations-api/.env`
- **Development mode**: Runs with `npm run dev`

### Frontend (Nuxt)
- **Port**: 5173
- **Development mode**: Runs with hot reload
- **Environment**: Uses root `.env`

## Development Workflow

1. **Make code changes** in your local files
2. **Rebuild services** if needed:
   ```bash
   docker-compose up --build
   ```
3. **View logs** to debug issues:
   ```bash
   docker-compose logs -f
   ```

## Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker info

# Check port conflicts
netstat -an | findstr "5173\|5001\|5433"  # Windows
lsof -i :5173,5001,5433  # Linux/Mac
```

### Database Connection Issues
```bash
# Check database health
docker-compose ps

# Connect to database directly
docker-compose exec postgres psql -U postgres -d postgres

# Reset database
docker-compose down -v
docker-compose up postgres
```

### Permission Issues
```bash
# Fix file permissions (Linux/Mac)
sudo chown -R $USER:$USER .

# Or run as current user
export UID=$(id -u)
export GID=$(id -g)
docker-compose up
```

### Out of Memory
- Increase Docker memory allocation in Docker Desktop settings
- Close other applications
- Use `docker system prune` to clean up

### CORS Issues
- Ensure `CORS_ORIGIN` in `operations-api/.env` includes your frontend URL
- For network access, add your IP: `http://192.168.1.100:5173`

## Production Deployment

For production, consider:
- Using environment-specific `.env` files
- Setting up proper SSL/TLS
- Using Docker secrets for sensitive data
- Implementing health checks and monitoring
- Using a reverse proxy (nginx)

## File Structure
```
Shpmarketing/
├── docker-compose.yml
├── .env                    # Frontend env vars
├── operations-api/
│   ├── .env               # API env vars
│   └── schema.sql         # Database schema
├── pages/                 # Nuxt pages
├── components/            # Vue components
└── ...
```

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure ports are not in use by other applications
4. Try rebuilding: `docker-compose up --build`