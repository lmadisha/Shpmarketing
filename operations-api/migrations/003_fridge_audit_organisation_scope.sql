BEGIN;

ALTER TABLE fridge_audit_log
  ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fridge_audit_log_organisation_id
ON fridge_audit_log (organisation_id);

UPDATE fridge_audit_log fal
SET organisation_id = derived.organisation_id
FROM (
  SELECT
    fal_inner.log_id,
    COALESCE(f.organisation_id, fm_org.organisation_id) AS organisation_id
  FROM fridge_audit_log fal_inner
  LEFT JOIN fridges f
    ON f.fridge_serial_number = fal_inner.fridge_serial_number
  LEFT JOIN (
    SELECT DISTINCT ON (fm.id)
      fm.id,
      fridges.organisation_id
    FROM fridge_mismatches fm
    LEFT JOIN fridges
      ON fridges.fridge_serial_number = fm.fridge_serial_number
    ORDER BY fm.id
  ) fm_org
    ON fal_inner.mismatch_id = fm_org.id
) AS derived
WHERE fal.log_id = derived.log_id
  AND fal.organisation_id IS NULL
  AND derived.organisation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION log_fridge_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      action_type,
      old_mac,
      new_mac,
      old_c_num,
      new_c_num,
      organisation_id,
      changed_by
    )
    VALUES (
      OLD.fridge_serial_number,
      'fridges',
      'UPDATE',
      OLD.iot_mac_address,
      NEW.iot_mac_address,
      OLD.c_number,
      NEW.c_number,
      COALESCE(NEW.organisation_id, OLD.organisation_id),
      NULLIF(current_user_id_text, '')::integer
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      action_type,
      new_mac,
      new_c_num,
      organisation_id,
      changed_by
    )
    VALUES (
      NEW.fridge_serial_number,
      'fridges',
      'INSERT',
      NEW.iot_mac_address,
      NEW.c_number,
      NEW.organisation_id,
      NULLIF(current_user_id_text, '')::integer
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      action_type,
      old_mac,
      old_c_num,
      organisation_id,
      changed_by
    )
    VALUES (
      OLD.fridge_serial_number,
      'fridges',
      'DELETE',
      OLD.iot_mac_address,
      OLD.c_number,
      OLD.organisation_id,
      NULLIF(current_user_id_text, '')::integer
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_fridge_mismatch_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
  audit_organisation_id INTEGER;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  SELECT organisation_id
  INTO audit_organisation_id
  FROM fridges
  WHERE fridge_serial_number = COALESCE(NEW.fridge_serial_number, OLD.fridge_serial_number)
  LIMIT 1;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      mismatch_id,
      action_type,
      new_mac,
      new_c_num,
      organisation_id,
      changed_by,
      metadata
    )
    VALUES (
      NEW.fridge_serial_number,
      'fridge_mismatches',
      NEW.id,
      'MISMATCH_INSERT',
      NEW.received_mac,
      NEW.received_c_number,
      audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'status', NEW.status,
        'db_mac', NEW.db_mac,
        'db_c_number', NEW.db_c_number,
        'resolved_at', NEW.resolved_at,
        'resolved_by', NEW.resolved_by,
        'resolution_note', NEW.resolution_note
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      mismatch_id,
      action_type,
      old_mac,
      new_mac,
      old_c_num,
      new_c_num,
      organisation_id,
      changed_by,
      metadata
    )
    VALUES (
      COALESCE(NEW.fridge_serial_number, OLD.fridge_serial_number),
      'fridge_mismatches',
      COALESCE(NEW.id, OLD.id),
      'MISMATCH_UPDATE',
      OLD.received_mac,
      NEW.received_mac,
      OLD.received_c_number,
      NEW.received_c_number,
      audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_db_mac', OLD.db_mac,
        'new_db_mac', NEW.db_mac,
        'old_db_c_number', OLD.db_c_number,
        'new_db_c_number', NEW.db_c_number,
        'resolved_at', NEW.resolved_at,
        'resolved_by', NEW.resolved_by,
        'resolution_note', NEW.resolution_note
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      mismatch_id,
      action_type,
      old_mac,
      old_c_num,
      organisation_id,
      changed_by,
      metadata
    )
    VALUES (
      OLD.fridge_serial_number,
      'fridge_mismatches',
      OLD.id,
      'MISMATCH_DELETE',
      OLD.received_mac,
      OLD.received_c_number,
      audit_organisation_id,
      NULLIF(current_user_id_text, '')::integer,
      jsonb_build_object(
        'status', OLD.status,
        'db_mac', OLD.db_mac,
        'db_c_number', OLD.db_c_number,
        'resolved_at', OLD.resolved_at,
        'resolved_by', OLD.resolved_by,
        'resolution_note', OLD.resolution_note
      )
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
