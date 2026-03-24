-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    permissions TEXT
);
 
-- Fridges table
CREATE TABLE fridges (
    fridge_serial_number VARCHAR(12) PRIMARY KEY,
    iot_mac_address VARCHAR(12) UNIQUE,
    c_number VARCHAR(10),
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ
);
 
-- Fridge mismatches table (tracks verification discrepancies from mobile scans)
CREATE TABLE fridge_mismatches (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    fridge_serial_number VARCHAR(32) NOT NULL,
    received_mac VARCHAR(64),
    received_c_number VARCHAR(32),
    db_mac VARCHAR(64),
    db_c_number VARCHAR(32),
    status VARCHAR(16) DEFAULT 'open' NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES users(id),
    resolution_note TEXT
);
 
-- Indexes for fridge_mismatches
CREATE INDEX idx_fridge_mismatches_received_at ON fridge_mismatches (received_at DESC);
CREATE INDEX idx_fridge_mismatches_serial ON fridge_mismatches (fridge_serial_number);
CREATE INDEX idx_fridge_mismatches_status ON fridge_mismatches (status);
 
-- Fridge audit log table
CREATE TABLE fridge_audit_log (
    log_id SERIAL PRIMARY KEY,
    fridge_serial_number VARCHAR(12),
    action_type TEXT, -- INSERT, UPDATE, or DELETE
    old_mac VARCHAR(12),
    new_mac VARCHAR(12),
    old_c_num VARCHAR(10),
    new_c_num VARCHAR(10),
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES users(id)
);
 
-- Trigger function to audit fridge changes
CREATE OR REPLACE FUNCTION log_fridge_changes()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id_text TEXT;
BEGIN
    current_user_id_text := current_setting('myapp.current_user_id', true);
 
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO fridge_audit_log (fridge_serial_number, action_type, old_mac, new_mac, old_c_num, new_c_num, changed_by)
        VALUES (OLD.fridge_serial_number, 'UPDATE', OLD.iot_mac_address, NEW.iot_mac_address, OLD.c_number, NEW.c_number, NULLIF(current_user_id_text, '')::integer);
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO fridge_audit_log (fridge_serial_number, action_type, new_mac, new_c_num, changed_by)
        VALUES (NEW.fridge_serial_number, 'INSERT', NEW.iot_mac_address, NEW.c_number, NULLIF(current_user_id_text, '')::integer);
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO fridge_audit_log (fridge_serial_number, action_type, old_mac, old_c_num, changed_by)
        VALUES (OLD.fridge_serial_number, 'DELETE', OLD.iot_mac_address, OLD.c_number, NULLIF(current_user_id_text, '')::integer);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trg_fridge_audit
AFTER INSERT OR UPDATE OR DELETE ON fridges
FOR EACH ROW EXECUTE FUNCTION log_fridge_changes();
 
-- Example usage:
-- SET myapp.current_user_id = '1';
-- INSERT INTO fridges (iot_mac_address, fridge_serial_number, c_number)
-- VALUES ('78EE4CE6923C', '003004192150', 'C13256');
 