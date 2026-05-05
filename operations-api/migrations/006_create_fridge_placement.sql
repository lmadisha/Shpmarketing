CREATE TABLE IF NOT EXISTS frostlink.fridge_placement (
  id                   BIGSERIAL PRIMARY KEY,
  fridge_serial_number VARCHAR(32) NOT NULL
    REFERENCES frostlink.fridges(fridge_serial_number) ON DELETE CASCADE,
  image                BYTEA NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by           INTEGER
    REFERENCES frostlink.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fridge_placement_serial
  ON frostlink.fridge_placement (fridge_serial_number);

CREATE INDEX IF NOT EXISTS idx_fridge_placement_created_at
  ON frostlink.fridge_placement (created_at DESC);