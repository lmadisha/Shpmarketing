# Migration Automation Guide

This document explains the automatic database migration system for Frostlink.

## Overview

As of this update, **outstanding SQL migrations in `operations-api/migrations/` are now applied automatically on every UAT and PROD deployment**, before the API service starts.

This ensures database schema changes are always synchronized with application code, eliminating the need for manual post-deploy migration steps.

## How It Works

### Migration Discovery

When the operations-api container starts:

1. **`run-migrations.js`** is executed before the API server
2. It scans `operations-api/migrations/` for `.sql` files in alphabetical order
3. Connects to PostgreSQL with retry logic (up to 30 attempts × 2 second delays)
4. Locks the migration table using PostgreSQL advisory locks (prevents concurrent applies)

### Migration Tracking

A tracking table `public.frostlink_migrations` records:
- `file_name`: Migration filename
- `checksum`: SHA256 hash of the SQL content
- `applied_at`: Timestamp of application

**Idempotency guarantees:**
- If a migration has already been applied with the same checksum, it is **skipped** (no re-run)
- If checksum differs for an already-applied migration, an error is raised (prevents corruption)

### Error Handling

If any migration fails:
- The error is logged with context
- The process exits with code 1, preventing the API from starting
- The container fails to reach healthy state
- Docker Compose marks the service unhealthy; dependent services do not start

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `operations-api/run-migrations.js` | **New** | Migration runner with idempotency & advisory locking |
| `operations-api/package.json` | Added `migrate:deploy` script | Explicit migration command |
| `operations-api/Dockerfile` | CMD changed to `npm run start:with-migrations` | Auto-migrate on container start |
| `bitbucket-pipelines.yml` | Added explicit `npm run migrate:deploy` before `docker compose up` | Ensures apply before services start |

## Deployment Flow

### UAT (automatic on every commit to `uat` branch)

```
Bitbucket Pipeline → Build images → Push to registry
  ↓
SSH to UAT host → Pull images
  ↓
docker compose run --rm operations-api npm run migrate:deploy
  ↓ (only if migrations succeed)
docker compose -f docker-compose.uat.yml up -d --no-build
```

**Double coverage:** Migrations run both in the pipeline step AND on container startup.

### PROD (automatic on commit to `main`, triggered manually)

Same as UAT, using `.env.prod` and docker-compose.prod.yml.

### Local Development

Migrations run automatically when you:
```bash
docker compose up --build
```

No manual steps required.

## Migration Files

All migration files are in `operations-api/migrations/` and numbered sequentially:

- `001_organisation_asset_validation_rules.sql` — Asset validation rules table
- `002_device_checker_location.sql` — Latitude/longitude columns + constraints
- `003_fridge_audit_organisation_scope.sql` — Audit log org scope + improved triggers
- `004_mismatch_audit_action_names.sql` — Enhanced mismatch action naming in audit logs

Each migration is wrapped in `BEGIN; ... COMMIT;` for atomicity. Using `IF NOT EXISTS` and `IF NOT ... THEN` guards ensures safe re-runs.

## Adding New Migrations

To create a new migration:

1. **Create file** in `operations-api/migrations/`
   - Use sequential number: `005_<short_description>.sql`
   - Example: `005_add_audit_timestamp.sql`

2. **Write safe SQL** using guards:
   ```sql
   BEGIN;

   ALTER TABLE fridges
     ADD COLUMN IF NOT EXISTS new_field VARCHAR(100);

   CREATE INDEX IF NOT EXISTS idx_new_field
   ON fridges (new_field);

   COMMIT;
   ```

3. **Test locally** before committing:
   ```bash
   docker compose down -v
   docker compose up --build
   # Check logs for migration success
   docker compose logs operations-api | grep -i migration
   ```

4. **Commit & push** — pipeline will auto-deploy on merge to `uat` or `main`

## Rollback & Troubleshooting

### Migration Failed During Deploy

1. Check the UAT host logs:
   ```bash
   docker compose -f docker-compose.uat.yml logs operations-api | grep -A 5 "migrations"
   ```

2. **Common issues:**
   - **Syntax error in .sql**: Fix the migration file, commit, redeploy
   - **Checksum mismatch**: A migration was modified after apply. Restore the original or create a new migration to fix data
   - **Database constraint violation**: The migration data operation conflicts with existing data. Update the migration logic and retry

3. **Manual remediation** (if urgent):
   ```bash
   # Connect to database
   docker compose -f docker-compose.uat.yml exec postgres psql -U frostlink -d frostlink

   # View applied migrations
   SELECT * FROM public.frostlink_migrations;

   # Delete a failed migration entry if needed (then retry deploy)
   DELETE FROM public.frostlink_migrations WHERE file_name = '005_...sql';
   ```

### Revert a Migration

Migrations are **forward-only**. To revert a change:
- Create a new migration (`006_revert_...sql`) that undoes the previous migration
- Do NOT delete or modify the original migration file
- Do NOT delete entries from the `frostlink_migrations` table

### Dry Run (Local Only)

```bash
docker compose exec operations-api npm run migrate:deploy
# (migrations will be applied if not already done)
```

## Verification

After deployment, verify migrations were applied:

### From Host

```bash
# UAT
docker compose -f docker-compose.uat.yml exec postgres psql -U frostlink -d frostlink \
  -c "SELECT file_name, applied_at FROM public.frostlink_migrations ORDER BY applied_at;"
```

### From Application Logs

```bash
docker compose -f docker-compose.uat.yml logs operations-api | grep "\[migrations\]"
```

Expected output:
```
[migrations] discovered 4 migration file(s), 0 already recorded.
[migrations] applying: 001_...sql
[migrations] applied: 001_...sql
[migrations] applying: 002_...sql
[migrations] applied: 002_...sql
...
[migrations] all pending migrations have been applied.
```

## Performance

- **First deploy** (new DB): ~1–5 seconds to apply all base schema + 4 migrations
- **Subsequent deploys** (existing DB, no pending migrations): <100ms (table lookup + lock/unlock, no SQL execution)
- **With pending migrations**: Depends on migration complexity (typically seconds)

Migrations run **serially in order** to preserve dependencies and ensure consistency.

## Safety Features

✅ **Idempotent** — Can be re-run safely; skips already-applied migrations  
✅ **Checksummed** — Detects file tampering (prevents corruption from modified migrations)  
✅ **Locked** — Advisory lock prevents concurrent applies in multi-instance scenarios  
✅ **Atomic** — Each migration is wrapped in BEGIN/COMMIT; partial applies are impossible  
✅ **Audited** — All applied migrations recorded with timestamp  
✅ **Ordered** — Applied in alphabetical order; new migrations execute in proper sequence  

## Additional Resources

- See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for full deployment procedures
- See [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md) for compose configuration details
- See [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) for local development
