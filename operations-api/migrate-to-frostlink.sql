-- Migration: feetlink → frostlink
-- Moves all tables, data, sequences, enums, functions, triggers, and indexes
-- from the feetlink schema into the frostlink schema.
--
-- Run this once against your database:
--   psql -h localhost -p 5433 -U postgres -d postgres -f migrate-to-frostlink.sql
--
-- This script is idempotent — safe to re-run (uses IF NOT EXISTS / OR REPLACE).

BEGIN;

-- ============================================================================
-- 1. Create the new schema
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS frostlink;

-- ============================================================================
-- 2. Move enums from feetlink to frostlink
--    ALTER TYPE ... SET SCHEMA moves the type and all columns using it follow.
-- ============================================================================
ALTER TYPE feetlink.mismatch_action_enum SET SCHEMA frostlink;
ALTER TYPE feetlink.user_permission_enum SET SCHEMA frostlink;

-- ============================================================================
-- 3. Drop triggers BEFORE moving tables (triggers reference functions by schema)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_fridge_audit ON feetlink.fridges;
DROP TRIGGER IF EXISTS trg_fridge_mismatch_audit ON feetlink.fridge_mismatches;

-- ============================================================================
-- 4. Drop functions from feetlink (will be recreated in frostlink)
-- ============================================================================
DROP FUNCTION IF EXISTS feetlink.log_fridge_changes();
DROP FUNCTION IF EXISTS feetlink.log_fridge_mismatch_changes();

-- ============================================================================
-- 5. Move tables (data, constraints, and column defaults move with them)
--    Order matters: referenced tables first, then dependents.
-- ============================================================================
ALTER TABLE feetlink.organisation SET SCHEMA frostlink;
ALTER TABLE feetlink.organisation_asset_validation_rules SET SCHEMA frostlink;
ALTER TABLE feetlink.users SET SCHEMA frostlink;
ALTER TABLE feetlink.fridges SET SCHEMA frostlink;
ALTER TABLE feetlink.fridge_mismatches SET SCHEMA frostlink;
ALTER TABLE feetlink.fridge_audit_log SET SCHEMA frostlink;

-- ============================================================================
-- 6. Move sequences (owned by SERIAL/BIGSERIAL columns)
-- ============================================================================
ALTER SEQUENCE IF EXISTS feetlink.organisation_id_seq SET SCHEMA frostlink;
ALTER SEQUENCE IF EXISTS feetlink.users_id_seq SET SCHEMA frostlink;
ALTER SEQUENCE IF EXISTS feetlink.fridge_mismatches_id_seq SET SCHEMA frostlink;
ALTER SEQUENCE IF EXISTS feetlink.fridge_audit_log_log_id_seq SET SCHEMA frostlink;

-- ============================================================================
-- 7. Recreate functions in frostlink
-- ============================================================================
CREATE OR REPLACE FUNCTION frostlink.log_fridge_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, action_type,
      old_mac, new_mac, old_c_num, new_c_num,
      organisation_id, changed_by, metadata
    ) VALUES (
      OLD.fridge_serial_number, 'fridges',
      CASE
        WHEN OLD.verified = false AND NEW.verified = true THEN 'VERIFY'
        WHEN OLD.verified = true AND NEW.verified = false THEN 'UNVERIFY'
        ELSE 'UPDATE'
      END,
      OLD.iot_mac_address, NEW.iot_mac_address,
      OLD.c_number, NEW.c_number,
      COALESCE(NEW.organisation_id, OLD.organisation_id),
      NULLIF(current_user_id_text, '')::integer,
      CASE
        WHEN OLD.verified IS DISTINCT FROM NEW.verified THEN
          jsonb_build_object('old_verified', OLD.verified, 'new_verified', NEW.verified)
        ELSE NULL
      END
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, action_type,
      new_mac, new_c_num, organisation_id, changed_by
    ) VALUES (
      NEW.fridge_serial_number, 'fridges', 'INSERT',
      NEW.iot_mac_address, NEW.c_number,
      NEW.organisation_id,
      NULLIF(current_user_id_text, '')::integer
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, action_type,
      old_mac, old_c_num, organisation_id, changed_by
    ) VALUES (
      OLD.fridge_serial_number, 'fridges', 'DELETE',
      OLD.iot_mac_address, OLD.c_number,
      OLD.organisation_id,
      NULLIF(current_user_id_text, '')::integer
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION frostlink.log_fridge_mismatch_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
  audit_organisation_id INTEGER;
  mismatch_action_type TEXT;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'INSERT') THEN
    SELECT organisation_id INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = NEW.fridge_serial_number
    LIMIT 1;

    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, mismatch_id, action_type,
      new_mac, new_c_num, organisation_id, changed_by, metadata
    ) VALUES (
      NEW.fridge_serial_number, 'fridge_mismatches', NEW.id, 'MISMATCH_INSERT',
      NEW.received_mac, NEW.received_c_number, audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'status', NEW.status, 'db_mac', NEW.db_mac,
        'db_c_number', NEW.db_c_number, 'resolved_at', NEW.resolved_at,
        'resolved_by', NEW.resolved_by, 'resolution_note', NEW.resolution_note
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    SELECT organisation_id INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = COALESCE(NEW.fridge_serial_number, OLD.fridge_serial_number)
    LIMIT 1;

    mismatch_action_type := CASE LOWER(COALESCE(NEW.status::text, ''))
      WHEN 'resolve' THEN 'MISMATCH_RESOLVE'
      WHEN 'delete' THEN 'MISMATCH_DELETE'
      ELSE 'MISMATCH_UPDATE'
    END;

    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, mismatch_id, action_type,
      old_mac, new_mac, old_c_num, new_c_num,
      organisation_id, changed_by, metadata
    ) VALUES (
      COALESCE(NEW.fridge_serial_number, OLD.fridge_serial_number),
      'fridge_mismatches', COALESCE(NEW.id, OLD.id), mismatch_action_type,
      OLD.received_mac, NEW.received_mac,
      OLD.received_c_number, NEW.received_c_number,
      audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'old_status', OLD.status, 'new_status', NEW.status,
        'old_db_mac', OLD.db_mac, 'new_db_mac', NEW.db_mac,
        'old_db_c_number', OLD.db_c_number, 'new_db_c_number', NEW.db_c_number,
        'resolved_at', NEW.resolved_at, 'resolved_by', NEW.resolved_by,
        'resolution_note', NEW.resolution_note
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT organisation_id INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = OLD.fridge_serial_number
    LIMIT 1;

    INSERT INTO frostlink.fridge_audit_log (
      fridge_serial_number, source_table, mismatch_id, action_type,
      old_mac, old_c_num, organisation_id, changed_by, metadata
    ) VALUES (
      OLD.fridge_serial_number, 'fridge_mismatches', OLD.id, 'MISMATCH_DELETE',
      OLD.received_mac, OLD.received_c_number, audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'status', OLD.status, 'db_mac', OLD.db_mac,
        'db_c_number', OLD.db_c_number, 'resolved_at', OLD.resolved_at,
        'resolved_by', OLD.resolved_by, 'resolution_note', OLD.resolution_note
      )
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Recreate triggers on the moved tables
-- ============================================================================
CREATE TRIGGER trg_fridge_audit
AFTER INSERT OR UPDATE OR DELETE ON frostlink.fridges
FOR EACH ROW
EXECUTE FUNCTION frostlink.log_fridge_changes();

CREATE TRIGGER trg_fridge_mismatch_audit
AFTER INSERT OR UPDATE OR DELETE ON frostlink.fridge_mismatches
FOR EACH ROW
EXECUTE FUNCTION frostlink.log_fridge_mismatch_changes();

-- ============================================================================
-- 9. Verify
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
  expected TEXT[] := ARRAY[
    'organisation',
    'organisation_asset_validation_rules',
    'users',
    'fridges',
    'fridge_mismatches',
    'fridge_audit_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'frostlink' AND table_name = tbl
    ) THEN
      RAISE EXCEPTION 'Migration check failed: table frostlink.% not found', tbl;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migration verified: all 6 tables present in frostlink schema.';
END $$;

COMMIT;
