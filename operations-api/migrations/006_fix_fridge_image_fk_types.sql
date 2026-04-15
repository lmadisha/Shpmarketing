BEGIN;

ALTER TABLE frostlink.fridges
  DROP CONSTRAINT IF EXISTS fridges_image_id_fkey;

ALTER TABLE frostlink.fridge_mismatches
  DROP CONSTRAINT IF EXISTS fridge_mismatches_image_id_fkey;

ALTER TABLE frostlink.fridges
  ALTER COLUMN image_id TYPE BIGINT USING image_id::BIGINT;

ALTER TABLE frostlink.fridge_mismatches
  ALTER COLUMN image_id TYPE BIGINT USING image_id::BIGINT;

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

COMMIT;
