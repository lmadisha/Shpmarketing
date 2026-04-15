BEGIN;

-- Remove the unique constraint/index on fridge MAC addresses
DROP INDEX IF EXISTS frostlink.iot_mac_address_unique_non_null_non_empty;

-- Add image links to existing tables
ALTER TABLE frostlink.fridges
  ADD COLUMN IF NOT EXISTS image_id BIGINT;

ALTER TABLE frostlink.fridge_mismatches
  ADD COLUMN IF NOT EXISTS image_id BIGINT;

-- Create fridge images table
CREATE TABLE IF NOT EXISTS frostlink.fridge_images (
  id BIGSERIAL PRIMARY KEY,
  fridge_serial_number VARCHAR(32) NOT NULL REFERENCES frostlink.fridges(fridge_serial_number) ON DELETE CASCADE,
  image BYTEA NOT NULL,
  mismatch_action frostlink.mismatch_action_enum,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES frostlink.users(id) ON DELETE SET NULL
);

-- Add foreign keys for image references
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridges_image_id_fkey'
  ) THEN
    ALTER TABLE frostlink.fridges
      ADD CONSTRAINT fridges_image_id_fkey
      FOREIGN KEY (image_id)
      REFERENCES frostlink.fridge_images(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridge_mismatches_image_id_fkey'
  ) THEN
    ALTER TABLE frostlink.fridge_mismatches
      ADD CONSTRAINT fridge_mismatches_image_id_fkey
      FOREIGN KEY (image_id)
      REFERENCES frostlink.fridge_images(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_fridge_images_fridge_serial_number
  ON frostlink.fridge_images (fridge_serial_number);

CREATE INDEX IF NOT EXISTS idx_fridge_images_created_at
  ON frostlink.fridge_images (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fridge_images_created_by
  ON frostlink.fridge_images (created_by);

CREATE INDEX IF NOT EXISTS idx_fridges_image_id
  ON frostlink.fridges (image_id);

CREATE INDEX IF NOT EXISTS idx_fridge_mismatches_image_id
  ON frostlink.fridge_mismatches (image_id);

COMMIT;
