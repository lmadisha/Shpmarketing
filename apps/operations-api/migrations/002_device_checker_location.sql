BEGIN;

ALTER TABLE frostlink.fridges
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

ALTER TABLE frostlink.fridge_mismatches
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridges_latitude_range_chk'
  ) THEN
    ALTER TABLE frostlink.fridges
      ADD CONSTRAINT fridges_latitude_range_chk
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridges_longitude_range_chk'
  ) THEN
    ALTER TABLE frostlink.fridges
      ADD CONSTRAINT fridges_longitude_range_chk
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridge_mismatches_latitude_range_chk'
  ) THEN
    ALTER TABLE frostlink.fridge_mismatches
      ADD CONSTRAINT fridge_mismatches_latitude_range_chk
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fridge_mismatches_longitude_range_chk'
  ) THEN
    ALTER TABLE frostlink.fridge_mismatches
      ADD CONSTRAINT fridge_mismatches_longitude_range_chk
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
END
$$;

COMMIT;
