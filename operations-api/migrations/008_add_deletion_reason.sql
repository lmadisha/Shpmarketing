BEGIN;

ALTER TABLE frostlink.fridge_audit_log
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

COMMIT;
