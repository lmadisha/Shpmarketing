# Docker Build & Push Workflow

This guide explains how to build Docker images locally and push them to the registry (`crg.apkg.io/digitaltwin_za`).

## Overview

The stack is configured to:
1. **Build images locally** from Dockerfiles
2. **Tag images** for the registry
3. **Push images** to `crg.apkg.io/digitaltwin_za`
4. **Pull images** during deployment

## Quick Start - Build & Push

### 1. Build All Images

Build both frontend and API images:

```bash
# Build with default tag (latest)
docker compose build

# Build with specific tag (recommended for releases)
FRONTEND_TAG=v1.0.0 OPS_API_TAG=v1.0.0 docker compose build
```

### 2. Tag Images for Registry

```bash
# Frontend image
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:latest crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0

# API image
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:latest crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.0.0
```

### 3. Push to Registry

First, authenticate with your registry:

```bash
# Docker login (one-time setup)
docker login crg.apkg.io
# Enter credentials when prompted
```

Then push images:

```bash
# Push all images
docker compose push

# Or push specific images
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.0.0
```

## Detailed Workflow

### Development Build (Local Testing)

```bash
# 1. Build images with 'latest' tag
docker compose build

# 2. Start stack to test
docker compose up

# 3. Test thoroughly
# - Access frontend: http://localhost:5173
# - Test API endpoints
# - Verify database

# 4. Stop when done
docker compose down
```

### Release Build & Push

```bash
# 1. Create release tag (recommend semantic versioning)
export TAG=v1.0.0

# 2. Build images with release tag
FRONTEND_TAG=$TAG OPS_API_TAG=$TAG docker compose build

# 3. Tag for registry (if not already done during build)
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$TAG crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$TAG
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$TAG crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$TAG

# 4. Test locally before pushing
FRONTEND_TAG=$TAG OPS_API_TAG=$TAG docker compose up
# Run full test suite...
docker compose down

# 5. Push to registry
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$TAG
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$TAG

# 6. Update 'latest' tag
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$TAG crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:latest
docker tag crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$TAG crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:latest
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:latest
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:latest
```

### UAT Deployment

```bash
# 1. Set UAT image tags in .env.uat
# FRONTEND_TAG=uat
# OPS_API_TAG=uat

# 2. Build UAT images
FRONTEND_TAG=uat OPS_API_TAG=uat docker compose -f docker-compose.uat.yml build

# 3. Test UAT images locally
FRONTEND_TAG=uat OPS_API_TAG=uat docker compose -f docker-compose.uat.yml up

# 4. Push UAT images to registry
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:uat
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:uat

# 5. On UAT server, pull and deploy
ssh user@uat-server
cd /path/to/frostlink
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:uat
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:uat
FRONTEND_TAG=uat OPS_API_TAG=uat docker compose -f docker-compose.uat.yml up -d --build
```

### Production Deployment

```bash
# 1. Set production image tags
export PROD_TAG=v1.0.0

# 2. Verify images exist in registry
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$PROD_TAG
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$PROD_TAG

# 3. On production server
ssh user@prod-server
cd /path/to/frostlink

# 4. Pull latest production images
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:$PROD_TAG
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:$PROD_TAG

# 5. Deploy
FRONTEND_TAG=$PROD_TAG OPS_API_TAG=$PROD_TAG docker compose -f docker-compose.prod.yml up -d --no-build
# Note: --no-build because we're using pre-built images
```

## Environment Variables for Tagging

Each environment should have image tag variables:

**.env (Development)**
```bash
FRONTEND_TAG=latest
OPS_API_TAG=latest
```

**.env.uat (Testing)**
```bash
FRONTEND_TAG=uat
OPS_API_TAG=uat
```

**.env.prod (Production)**
```bash
FRONTEND_TAG=v1.0.0
OPS_API_TAG=v1.0.0
```

## Docker Compose Integration

Images are automatically tagged based on `.env` variables:

```yaml
services:
  frontend:
    image: crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:${FRONTEND_TAG:-latest}
    build:
      context: .
      dockerfile: Dockerfile

  operations-api:
    image: crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:${OPS_API_TAG:-latest}
    build:
      context: .
      dockerfile: operations-api/Dockerfile
```

**Build behavior:**
- `docker compose build` → builds and tags with env variables
- `docker compose up` → uses local images, builds if missing
- `docker compose push` → pushes locally-built images to registry
- `docker compose -f docker-compose.prod.yml up -d --no-build` → pulls from registry

## Tag Naming Convention

Recommend using semantic versioning:

```
crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0
crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.1
crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.1.0
crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:latest
crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:uat

crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.0.0
crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.0.1
crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.1.0
crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:latest
crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:uat
```

## Registry Management

### View Images in Registry

```bash
# List local images
docker images | grep "crg.apkg.io"

# Check registry for specific image (if registry API exposed)
curl -u user:pass https://crg.apkg.io/api/v2/repositories/digitaltwin_za/digital.frostlink.frontend/tags/
```

### Clean Up Local Images

```bash
# Remove specific image
docker rmi crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:latest

# Remove all local images for project
docker rmi $(docker images crg.apkg.io/digitaltwin_za/digital.frostlink* -q)

# Clean up unused images
docker image prune

# Full cleanup (be careful!)
docker system prune -a
```

## CI/CD Integration

For automated builds, use Docker Buildx:

```bash
# Build for multiple platforms
docker buildx build \
  -t crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0 \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile \
  .

docker buildx build \
  -t crg.apkg.io/digitaltwin_za/digital.frostlink.operations-api:v1.0.0 \
  --platform linux/amd64,linux/arm64 \
  -f operations-api/Dockerfile \
  operations-api/
```

## Troubleshooting

### Login Issues

```bash
# Test registry login
docker login crg.apkg.io

# Check credentials
cat ~/.docker/config.json  # Linux/macOS
type %USERPROFILE%\.docker\config.json  # Windows
```

### Push Fails

```bash
# Verify image exists locally
docker images | grep digital.frostlink

# Check registry connectivity
curl -I https://crg.apkg.io/

# View push logs
docker push crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0 --verbose
```

### Pull Issues

```bash
# Verify image exists in registry
docker search crg.apkg.io/digitaltwin_za/digital.frostlink

# Check network connectivity
ping crg.apkg.io

# Try manual pull
docker pull crg.apkg.io/digitaltwin_za/digital.frostlink.frontend:v1.0.0
```

## Best Practices

1. **Use semantic versioning** for production releases
2. **Tag and test locally** before pushing
3. **Keep `latest` tag updated** for development
4. **Use specific tags for UAT and Prod** (not `latest`)
5. **Push after successful testing** in each environment
6. **Document tag purposes:** `latest` (dev), `uat` (testing), `v*.*.* ` (production)
7. **Maintain backup tags** for quick rollbacks
8. **Clean old images** regularly to save space

## Workflows

### Local Development Loop
```
Code change → docker compose build → docker compose up → Test → docker compose down
```

### UAT Release
```
Code finalized → FRONTEND_TAG=uat OPS_API_TAG=uat docker compose build
→ docker compose -f docker-compose.uat.yml up → Full testing
→ docker push (both images) → Deploy to UAT server
```

### Production Release
```
UAT passed → Tag as v1.0.0 → docker compose build → Local verification
→ docker push (both images) → Update .env.prod with tag
→ ssh prod-server → docker pull (both) → docker compose -f docker-compose.prod.yml up -d --no-build
```

## Related Documentation

- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Deployment procedures
- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - Development guide
- [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) - Command reference
