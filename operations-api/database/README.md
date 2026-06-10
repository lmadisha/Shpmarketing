# Database

Database schema, migrations, and documentation for the Operations API.

## Directory Structure

```
database/
├── migrations/              SQL migration files (reversible up/down)
├── schema/                  Generated schema documentation
│   ├── SCHEMA.md           Human-readable schema reference
│   └── schema.json         Machine-readable schema data
├── extract-schema.js       Script to extract schema from database
├── post-migrate.js         Hook to auto-run after migrations
└── README.md               This file
```

## Migrations

Reversible migrations with UP and DOWN sections.

**Run migrations:**
```bash
npm run migrate:deploy       # Apply pending migrations (UP)
npm run migrate:down         # Rollback last batch (DOWN)
```

**Create new migration:**
Use the `superpowers:create-migration` skill to generate migration files with both directions.

Format:
```sql
-- Description: Brief description of change
-- UP
[SQL to apply]

-- DOWN
[SQL to revert]
```

## Schema Documentation

Auto-generated from database state after migrations.

**Files:**
- **SCHEMA.md** — Human-readable tables, columns, constraints, indexes, triggers
- **schema.json** — Machine-readable schema structure for tooling

**Regenerate:**
```bash
npm run schema:extract      # Manual extraction
npm run migrate:deploy      # Auto-extracts after migrations
npm run migrate:down        # Auto-extracts after rollback
```

## Workflow

1. Create migration: Use `superpowers:create-migration` skill
2. Run migrations: `npm run migrate:deploy`
3. Schema auto-updates: `extract-schema.js` runs post-migration
4. Commit changes: Stage both migration files + updated schema docs

## Schema Files

### SCHEMA.md

Human-readable reference generated from database. Contains:
- All tables with columns, types, nullability
- Indexes and their definitions
- Triggers and events
- Custom types and enums
- Function definitions

### schema.json

Machine-readable schema snapshot for tooling. Structure:
```json
{
  "timestamp": "2026-05-07T11:29:15.000Z",
  "tables": [...],
  "columns": {...},
  "constraints": {...},
  "indexes": {...},
  "triggers": {...},
  "functions": [...],
  "types": {...}
}
```

## Tips

- **Before committing** — Run `npm run migrate:deploy` to ensure schema docs are current
- **Review schema changes** — Check SCHEMA.md diff to understand impact
- **One migration per change** — Keep migrations focused and reversible
- **Test both directions** — Always test UP and DOWN migrations locally
- **Document large changes** — Add comments in migrations for complex logic
