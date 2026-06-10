-- Description: Add placed column to fridges table
-- UP
ALTER TABLE frostlink.fridges ADD COLUMN IF NOT EXISTS placed BOOLEAN NOT NULL DEFAULT FALSE;

-- DOWN
ALTER TABLE frostlink.fridges DROP COLUMN IF EXISTS placed;
