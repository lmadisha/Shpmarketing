-- Description: Add direction column to schema_migrations table for reversible migrations
-- UP
ALTER TABLE public.frostlink_migrations ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'up';

-- DOWN
ALTER TABLE public.frostlink_migrations DROP COLUMN IF EXISTS direction;
