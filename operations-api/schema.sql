-- Operations database schema

CREATE TYPE mismatch_action_enum AS ENUM ('open', 'resolve', 'cancel', 'delete');

CREATE TYPE user_permission_enum AS ENUM (
  'Admin',
  'Fleet Manager',
  'Factory',
  'Outlet',
  'Technician',
  'User'
);

CREATE TABLE organisation (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  domin VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organisation_asset_validation_rules (
  organisation_id INTEGER PRIMARY KEY REFERENCES organisation(id) ON DELETE CASCADE,
  serial_min_length INTEGER NOT NULL CHECK (serial_min_length > 0 AND serial_min_length <= 32),
  serial_max_length INTEGER NOT NULL CHECK (serial_max_length > 0 AND serial_max_length <= 32),
  mac_min_length INTEGER NOT NULL CHECK (mac_min_length > 0 AND mac_min_length <= 64),
  mac_max_length INTEGER NOT NULL CHECK (mac_max_length > 0 AND mac_max_length <= 64),
  c_number_min_length INTEGER NOT NULL CHECK (c_number_min_length > 0 AND c_number_min_length <= 32),
  c_number_max_length INTEGER NOT NULL CHECK (c_number_max_length > 0 AND c_number_max_length <= 32),
  CHECK (serial_min_length <= serial_max_length),
  CHECK (mac_min_length <= mac_max_length),
  CHECK (c_number_min_length <= c_number_max_length)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  permissions user_permission_enum NOT NULL,
  organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL
);

CREATE TABLE fridges (
  fridge_serial_number VARCHAR(32) PRIMARY KEY,
  iot_mac_address VARCHAR(64) UNIQUE,
  c_number VARCHAR(32),
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE fridge_mismatches (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  fridge_serial_number VARCHAR(32) NOT NULL,
  received_mac VARCHAR(64),
  received_c_number VARCHAR(32),
  db_mac VARCHAR(64),
  db_c_number VARCHAR(32),
  status mismatch_action_enum DEFAULT 'open' NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES users(id),
  resolution_note TEXT,
  sender_id INTEGER REFERENCES users(id),
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE fridge_audit_log (
  log_id SERIAL PRIMARY KEY,
  fridge_serial_number VARCHAR(32),
  source_table TEXT DEFAULT 'fridges' NOT NULL,
  action_type TEXT,
  old_mac VARCHAR(64),
  new_mac VARCHAR(64),
  old_c_num VARCHAR(32),
  new_c_num VARCHAR(32),
  mismatch_id BIGINT,
  metadata JSONB,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_fridge_mismatches_received_at ON fridge_mismatches (received_at DESC);
CREATE INDEX idx_fridge_mismatches_serial ON fridge_mismatches (fridge_serial_number);
CREATE INDEX idx_fridge_mismatches_status ON fridge_mismatches (status);
CREATE INDEX idx_users_organisation_id ON users (organisation_id);
CREATE INDEX idx_fridges_organisation_id ON fridges (organisation_id);
CREATE UNIQUE INDEX idx_organisation_domin_unique
ON organisation ((LOWER(domin)))
WHERE domin IS NOT NULL;
CREATE INDEX idx_fridge_audit_log_serial ON fridge_audit_log (fridge_serial_number);
CREATE INDEX idx_fridge_audit_log_source_table ON fridge_audit_log (source_table);
CREATE INDEX idx_fridge_audit_log_mismatch_id ON fridge_audit_log (mismatch_id);
CREATE UNIQUE INDEX iot_mac_address_unique_non_null_non_empty
ON fridges (iot_mac_address)
WHERE iot_mac_address IS NOT NULL AND iot_mac_address <> '';

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
      NULLIF(current_user_id_text, '')::integer
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      action_type,
      new_mac,
      new_c_num,
      changed_by
    )
    VALUES (
      NEW.fridge_serial_number,
      'fridges',
      'INSERT',
      NEW.iot_mac_address,
      NEW.c_number,
      NULLIF(current_user_id_text, '')::integer
    );
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      action_type,
      old_mac,
      old_c_num,
      changed_by
    )
    VALUES (
      OLD.fridge_serial_number,
      'fridges',
      'DELETE',
      OLD.iot_mac_address,
      OLD.c_number,
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
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO fridge_audit_log (
      fridge_serial_number,
      source_table,
      mismatch_id,
      action_type,
      new_mac,
      new_c_num,
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

CREATE TRIGGER trg_fridge_audit
AFTER INSERT OR UPDATE OR DELETE ON fridges
FOR EACH ROW
EXECUTE FUNCTION log_fridge_changes();

CREATE TRIGGER trg_fridge_mismatch_audit
AFTER INSERT OR UPDATE OR DELETE ON fridge_mismatches
FOR EACH ROW
EXECUTE FUNCTION log_fridge_mismatch_changes();
