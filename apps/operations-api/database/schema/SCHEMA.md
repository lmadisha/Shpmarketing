# frostlink Schema

**Generated:** 2026/05/07, 11:39:36

## Tables

### fridge_audit_log

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| log_id | integer | No | nextval('frostlink.fridge_audit_log_log_id_seq'::regclass) |  |
| fridge_serial_number | character varying | Yes |  |  |
| action_type | text | Yes |  |  |
| old_mac | character varying | Yes |  |  |
| new_mac | character varying | Yes |  |  |
| old_c_num | character varying | Yes |  |  |
| new_c_num | character varying | Yes |  |  |
| changed_at | timestamp with time zone | Yes | CURRENT_TIMESTAMP |  |
| changed_by | integer | Yes |  |  |
| source_table | text | No | 'fridges'::text |  |
| mismatch_id | bigint | Yes |  |  |
| metadata | jsonb | Yes |  |  |
| deletion_reason | text | Yes |  |  |
| organisation_id | integer | Yes |  |  |

### fridge_images

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | bigint | No | nextval('frostlink.fridge_images_id_seq'::regclass) |  |
| fridge_serial_number | character varying | No |  |  |
| image | bytea | No |  |  |
| mismatch_action | USER-DEFINED | Yes |  |  |
| created_at | timestamp with time zone | No | CURRENT_TIMESTAMP |  |
| created_by | integer | Yes |  |  |

### fridge_mismatches

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | bigint | No | nextval('frostlink.fridge_mismatches_id_seq'::regclass) |  |
| received_at | timestamp with time zone | No | now() |  |
| fridge_serial_number | character varying | No |  |  |
| received_mac | character varying | Yes |  |  |
| received_c_number | character varying | Yes |  |  |
| db_mac | character varying | Yes |  |  |
| db_c_number | character varying | Yes |  |  |
| status | USER-DEFINED | No | 'open'::frostlink.mismatch_action_enum |  |
| resolved_at | timestamp with time zone | Yes |  |  |
| resolved_by | integer | Yes |  |  |
| resolution_note | text | Yes |  |  |
| sender_id | integer | Yes |  |  |
| latitude | numeric | Yes |  |  |
| longitude | numeric | Yes |  |  |
| image_id | integer | Yes |  |  |

### fridge_placement

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | bigint | No | nextval('frostlink.fridge_placement_id_seq'::regclass) |  |
| fridge_serial_number | character varying | No |  |  |
| image | bytea | No |  |  |
| created_at | timestamp with time zone | No | CURRENT_TIMESTAMP |  |
| created_by | integer | Yes |  |  |

### fridges

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| fridge_serial_number | character varying | No |  |  |
| iot_mac_address | character varying | Yes |  |  |
| c_number | character varying | Yes |  |  |
| verified | boolean | Yes | false |  |
| verified_at | timestamp with time zone | Yes |  |  |
| organisation_id | integer | Yes |  |  |
| latitude | numeric | Yes |  |  |
| longitude | numeric | Yes |  |  |
| image_id | integer | Yes |  |  |
| placed | boolean | No | false |  |

### organisation

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | integer | No | nextval('frostlink.organisation_id_seq'::regclass) |  |
| name | character varying | No |  |  |
| created_at | timestamp with time zone | Yes | CURRENT_TIMESTAMP |  |
| domin | character varying | Yes |  |  |

### organisation_asset_validation_rules

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| organisation_id | integer | No |  |  |
| serial_min_length | integer | No |  |  |
| serial_max_length | integer | No |  |  |
| mac_min_length | integer | No |  |  |
| mac_max_length | integer | No |  |  |
| c_number_min_length | integer | No |  |  |
| c_number_max_length | integer | No |  |  |

### schema_migrations

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | integer | No | nextval('frostlink.schema_migrations_id_seq'::regclass) |  |
| id | integer | No | nextval('frostlink.schema_migrations_id_seq'::regclass) |  |
| id | integer | No | nextval('schema_migrations_id_seq'::regclass) |  |
| id | integer | No | nextval('schema_migrations_id_seq'::regclass) |  |
| name | character varying | No |  |  |
| name | character varying | No |  |  |
| name | character varying | No |  |  |
| name | character varying | No |  |  |
| applied_at | timestamp with time zone | No | now() |  |
| applied_at | timestamp with time zone | No | now() |  |
| applied_at | timestamp with time zone | No | now() |  |
| applied_at | timestamp with time zone | No | now() |  |

### users

| Column | Type | Nullable | Default | Comment |
|--------|------|----------|---------|----------|
| id | integer | No | nextval('frostlink.users_id_seq'::regclass) |  |
| username | character varying | No |  |  |
| password_hash | text | No |  |  |
| full_name | character varying | Yes |  |  |
| is_active | boolean | Yes | true |  |
| created_at | timestamp with time zone | Yes | CURRENT_TIMESTAMP |  |
| permissions | USER-DEFINED | No |  |  |
| organisation_id | integer | Yes |  |  |
| first_name | character varying | Yes |  |  |
| last_name | character varying | Yes |  |  |

## Indexes

### fridge_audit_log

- **fridge_audit_log_pkey**: CREATE UNIQUE INDEX fridge_audit_log_pkey ON frostlink.fridge_audit_log USING btree (log_id)
- **idx_fridge_audit_log_mismatch_id**: CREATE INDEX idx_fridge_audit_log_mismatch_id ON frostlink.fridge_audit_log USING btree (mismatch_id)
- **idx_fridge_audit_log_serial**: CREATE INDEX idx_fridge_audit_log_serial ON frostlink.fridge_audit_log USING btree (fridge_serial_number)
- **idx_fridge_audit_log_source_table**: CREATE INDEX idx_fridge_audit_log_source_table ON frostlink.fridge_audit_log USING btree (source_table)

### fridge_images

- **fridge_images_pkey**: CREATE UNIQUE INDEX fridge_images_pkey ON frostlink.fridge_images USING btree (id)
- **idx_fridge_images_created_at**: CREATE INDEX idx_fridge_images_created_at ON frostlink.fridge_images USING btree (created_at DESC)
- **idx_fridge_images_created_by**: CREATE INDEX idx_fridge_images_created_by ON frostlink.fridge_images USING btree (created_by)
- **idx_fridge_images_fridge_serial_number**: CREATE INDEX idx_fridge_images_fridge_serial_number ON frostlink.fridge_images USING btree (fridge_serial_number)

### fridge_mismatches

- **fridge_mismatches_pkey**: CREATE UNIQUE INDEX fridge_mismatches_pkey ON frostlink.fridge_mismatches USING btree (id)
- **idx_fridge_mismatches_image_id**: CREATE INDEX idx_fridge_mismatches_image_id ON frostlink.fridge_mismatches USING btree (image_id)
- **idx_fridge_mismatches_received_at**: CREATE INDEX idx_fridge_mismatches_received_at ON frostlink.fridge_mismatches USING btree (received_at DESC)
- **idx_fridge_mismatches_serial**: CREATE INDEX idx_fridge_mismatches_serial ON frostlink.fridge_mismatches USING btree (fridge_serial_number)
- **idx_fridge_mismatches_status**: CREATE INDEX idx_fridge_mismatches_status ON frostlink.fridge_mismatches USING btree (status)

### fridge_placement

- **fridge_placement_pkey**: CREATE UNIQUE INDEX fridge_placement_pkey ON frostlink.fridge_placement USING btree (id)
- **idx_fridge_placement_created_at**: CREATE INDEX idx_fridge_placement_created_at ON frostlink.fridge_placement USING btree (created_at DESC)
- **idx_fridge_placement_serial**: CREATE INDEX idx_fridge_placement_serial ON frostlink.fridge_placement USING btree (fridge_serial_number)

### fridges

- **fridges_iot_mac_address_key**: CREATE UNIQUE INDEX fridges_iot_mac_address_key ON frostlink.fridges USING btree (iot_mac_address)
- **fridges_pkey**: CREATE UNIQUE INDEX fridges_pkey ON frostlink.fridges USING btree (fridge_serial_number)
- **idx_fridges_image_id**: CREATE INDEX idx_fridges_image_id ON frostlink.fridges USING btree (image_id)
- **idx_fridges_organisation_id**: CREATE INDEX idx_fridges_organisation_id ON frostlink.fridges USING btree (organisation_id)

### organisation

- **idx_organisation_domin_unique**: CREATE UNIQUE INDEX idx_organisation_domin_unique ON frostlink.organisation USING btree (lower((domin)::text)) WHERE (domin IS NOT NULL)
- **organisation_name_key**: CREATE UNIQUE INDEX organisation_name_key ON frostlink.organisation USING btree (name)
- **organisation_pkey**: CREATE UNIQUE INDEX organisation_pkey ON frostlink.organisation USING btree (id)

### organisation_asset_validation_rules

- **organisation_asset_validation_rules_pkey**: CREATE UNIQUE INDEX organisation_asset_validation_rules_pkey ON frostlink.organisation_asset_validation_rules USING btree (organisation_id)

### schema_migrations

- **schema_migrations_name_key**: CREATE UNIQUE INDEX schema_migrations_name_key ON frostlink.schema_migrations USING btree (name)
- **schema_migrations_pkey**: CREATE UNIQUE INDEX schema_migrations_pkey ON frostlink.schema_migrations USING btree (id)

### users

- **idx_users_organisation_id**: CREATE INDEX idx_users_organisation_id ON frostlink.users USING btree (organisation_id)
- **users_pkey**: CREATE UNIQUE INDEX users_pkey ON frostlink.users USING btree (id)
- **users_username_key**: CREATE UNIQUE INDEX users_username_key ON frostlink.users USING btree (username)

## Types/Enums

### mismatch_action_enum

- cancel
- delete
- open
- resolve

### user_permission_enum

- Admin
- Advanced
- Basic
- Intermediate
- __deprecated_factory
- __deprecated_outlet

## Triggers

### fridge_mismatches

- **trg_fridge_mismatch_audit** (AFTER INSERT)
- **trg_fridge_mismatch_audit** (AFTER DELETE)
- **trg_fridge_mismatch_audit** (AFTER UPDATE)

### fridges

- **trg_fridge_audit** (AFTER INSERT)
- **trg_fridge_audit** (AFTER DELETE)
- **trg_fridge_audit** (AFTER UPDATE)

## Functions

### log_fridge_changes

```sql
CREATE OR REPLACE FUNCTION frostlink.log_fridge_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

```

### log_fridge_mismatch_changes

```sql
CREATE OR REPLACE FUNCTION frostlink.log_fridge_mismatch_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

```

