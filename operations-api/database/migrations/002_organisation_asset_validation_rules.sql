-- Description: Create organisation_asset_validation_rules table
-- UP
CREATE TABLE IF NOT EXISTS frostlink.organisation_asset_validation_rules (
  organisation_id INTEGER PRIMARY KEY REFERENCES frostlink.organisation(id) ON DELETE CASCADE,
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

-- DOWN
DROP TABLE IF EXISTS frostlink.organisation_asset_validation_rules;
