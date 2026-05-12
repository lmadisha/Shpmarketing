-- Description: Add deletion_reason and organisation_id columns to fridge_audit_log
-- UP
ALTER TABLE frostlink.fridge_audit_log ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE frostlink.fridge_audit_log ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES frostlink.organisation(id) ON DELETE SET NULL;

-- DOWN
ALTER TABLE frostlink.fridge_audit_log DROP COLUMN IF EXISTS deletion_reason;
ALTER TABLE frostlink.fridge_audit_log DROP COLUMN IF EXISTS organisation_id;
