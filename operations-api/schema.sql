-- Operations database schema migrated from artic application

DO $$
BEGIN
  CREATE TYPE mismatch_action_enum AS ENUM ('open', 'resolve', 'cancel', 'delete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE user_permission_enum AS ENUM ('Admin', 'Fleet Manager', 'Technician', 'User');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS organisation (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  domin VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS fridges (
  fridge_serial_number VARCHAR(12) PRIMARY KEY,
  iot_mac_address VARCHAR(12) UNIQUE,
  c_number VARCHAR(10),
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fridge_mismatches (
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
  resolution_note TEXT
);

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.organisation
  ADD COLUMN IF NOT EXISTS domin VARCHAR(120);

ALTER TABLE IF EXISTS public.fridges
  ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisation(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'permissions'
      AND udt_name <> 'user_permission_enum'
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN permissions TYPE user_permission_enum
      USING (
        CASE LOWER(TRIM(permissions::text))
          WHEN 'admin' THEN 'Admin'
          WHEN 'fleet manager' THEN 'Fleet Manager'
          WHEN 'intermediate' THEN 'Fleet Manager'
          WHEN 'technician' THEN 'Technician'
          WHEN 'basic' THEN 'User'
          WHEN 'user' THEN 'User'
          WHEN 'users' THEN 'User'
          ELSE 'User'
        END
      )::user_permission_enum;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fridge_mismatches'
      AND column_name = 'status'
      AND udt_name <> 'mismatch_action_enum'
  ) THEN
    ALTER TABLE public.fridge_mismatches
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE mismatch_action_enum
      USING (
        CASE LOWER(status::text)
          WHEN 'resolved' THEN 'resolve'
          WHEN 'deleted' THEN 'delete'
          WHEN 'cancelled' THEN 'cancel'
          WHEN 'canceled' THEN 'cancel'
          ELSE LOWER(status::text)
        END
      )::mismatch_action_enum,
      ALTER COLUMN status SET DEFAULT 'open'::mismatch_action_enum;
  ELSE
    ALTER TABLE public.fridge_mismatches
      ALTER COLUMN status SET DEFAULT 'open'::mismatch_action_enum;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.fridge_mismatches
  ADD COLUMN IF NOT EXISTS sender_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_fridge_mismatches_received_at ON fridge_mismatches (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_fridge_mismatches_serial ON fridge_mismatches (fridge_serial_number);
CREATE INDEX IF NOT EXISTS idx_fridge_mismatches_status ON fridge_mismatches (status);
CREATE INDEX IF NOT EXISTS idx_users_organisation_id ON users (organisation_id);
CREATE INDEX IF NOT EXISTS idx_fridges_organisation_id ON fridges (organisation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organisation_domin_unique
ON organisation ((LOWER(domin)))
WHERE domin IS NOT NULL;

CREATE TABLE IF NOT EXISTS fridge_audit_log (
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

ALTER TABLE IF EXISTS public.fridge_audit_log
  ALTER COLUMN fridge_serial_number TYPE VARCHAR(32);

ALTER TABLE IF EXISTS public.fridge_audit_log
  ALTER COLUMN old_mac TYPE VARCHAR(64);

ALTER TABLE IF EXISTS public.fridge_audit_log
  ALTER COLUMN new_mac TYPE VARCHAR(64);

ALTER TABLE IF EXISTS public.fridge_audit_log
  ALTER COLUMN old_c_num TYPE VARCHAR(32);

ALTER TABLE IF EXISTS public.fridge_audit_log
  ALTER COLUMN new_c_num TYPE VARCHAR(32);

ALTER TABLE IF EXISTS public.fridge_audit_log
  ADD COLUMN IF NOT EXISTS source_table TEXT DEFAULT 'fridges' NOT NULL;

ALTER TABLE IF EXISTS public.fridge_audit_log
  ADD COLUMN IF NOT EXISTS mismatch_id BIGINT;

ALTER TABLE IF EXISTS public.fridge_audit_log
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_fridge_audit_log_serial ON fridge_audit_log (fridge_serial_number);
CREATE INDEX IF NOT EXISTS idx_fridge_audit_log_source_table ON fridge_audit_log (source_table);
CREATE INDEX IF NOT EXISTS idx_fridge_audit_log_mismatch_id ON fridge_audit_log (mismatch_id);

CREATE OR REPLACE FUNCTION log_fridge_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id_text TEXT;
BEGIN
  current_user_id_text := current_setting('myapp.current_user_id', true);

  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO fridge_audit_log (fridge_serial_number, source_table, action_type, old_mac, new_mac, old_c_num, new_c_num, changed_by)
    VALUES (OLD.fridge_serial_number, 'fridges', 'UPDATE', OLD.iot_mac_address, NEW.iot_mac_address, OLD.c_number, NEW.c_number, NULLIF(current_user_id_text, '')::integer);
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO fridge_audit_log (fridge_serial_number, source_table, action_type, new_mac, new_c_num, changed_by)
    VALUES (NEW.fridge_serial_number, 'fridges', 'INSERT', NEW.iot_mac_address, NEW.c_number, NULLIF(current_user_id_text, '')::integer);
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO fridge_audit_log (fridge_serial_number, source_table, action_type, old_mac, old_c_num, changed_by)
    VALUES (OLD.fridge_serial_number, 'fridges', 'DELETE', OLD.iot_mac_address, OLD.c_number, NULLIF(current_user_id_text, '')::integer);
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

DROP TRIGGER IF EXISTS trg_fridge_audit ON fridges;
CREATE TRIGGER trg_fridge_audit
AFTER INSERT OR UPDATE OR DELETE ON fridges
FOR EACH ROW
EXECUTE FUNCTION log_fridge_changes();

DROP TRIGGER IF EXISTS trg_fridge_mismatch_audit ON fridge_mismatches;
CREATE TRIGGER trg_fridge_mismatch_audit
AFTER INSERT OR UPDATE OR DELETE ON fridge_mismatches
FOR EACH ROW
EXECUTE FUNCTION log_fridge_mismatch_changes();

CREATE UNIQUE INDEX IF NOT EXISTS iot_mac_address_unique_non_null_non_empty
ON public.fridges (iot_mac_address)
WHERE iot_mac_address IS NOT NULL AND iot_mac_address <> '';
