BEGIN;

CREATE TABLE IF NOT EXISTS frostlink.fridge_images (
  id BIGSERIAL PRIMARY KEY,
  fridge_serial_number VARCHAR(32) NOT NULL REFERENCES frostlink.fridges(fridge_serial_number) ON DELETE CASCADE,
  image BYTEA NOT NULL,
  mismatch_action frostlink.mismatch_action_enum,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES frostlink.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fridge_images_fridge_serial_number
ON frostlink.fridge_images (fridge_serial_number);

CREATE INDEX IF NOT EXISTS idx_fridge_images_created_at
ON frostlink.fridge_images (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fridge_images_created_by
ON frostlink.fridge_images (created_by);

ALTER TABLE frostlink.fridges
  ADD COLUMN IF NOT EXISTS image_id BIGINT;

ALTER TABLE frostlink.fridges
  ADD CONSTRAINT IF NOT EXISTS fk_fridges_image_id
  FOREIGN KEY (image_id) REFERENCES frostlink.fridge_images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fridges_image_id
ON frostlink.fridges (image_id);

COMMIT;
