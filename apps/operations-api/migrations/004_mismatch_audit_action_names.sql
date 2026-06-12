BEGIN;

CREATE OR REPLACE FUNCTION frostlink.log_fridge_mismatch_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
  audit_organisation_id INTEGER;
  mismatch_action_type TEXT;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'INSERT') THEN
    SELECT organisation_id
    INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = NEW.fridge_serial_number
    LIMIT 1;

    INSERT INTO frostlink.fridge_audit_log (
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
    SELECT organisation_id
    INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = COALESCE(NEW.fridge_serial_number, OLD.fridge_serial_number)
    LIMIT 1;

    mismatch_action_type := CASE LOWER(COALESCE(NEW.status::text, ''))
      WHEN 'resolve' THEN 'MISMATCH_RESOLVE'
      WHEN 'delete' THEN 'MISMATCH_DELETE'
      ELSE 'MISMATCH_UPDATE'
    END;

    INSERT INTO frostlink.fridge_audit_log (
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
      mismatch_action_type,
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
    SELECT organisation_id
    INTO audit_organisation_id
    FROM frostlink.fridges
    WHERE fridge_serial_number = OLD.fridge_serial_number
    LIMIT 1;

    INSERT INTO frostlink.fridge_audit_log (
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
