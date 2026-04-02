-- Migration: Rename and consolidate permission levels
-- Admin (unchanged), Fleet Manager→Advanced, Technician→Intermediate, User→Basic
-- Factory and Outlet users are mapped to Intermediate, then those enum values are removed.
--
-- Run: psql -h localhost -p 5433 -U postgres -d postgres -f operations-api/migrate-permissions.sql

BEGIN;

-- 1. Rename existing enum values
ALTER TYPE frostlink.user_permission_enum RENAME VALUE 'Fleet Manager' TO 'Advanced';
ALTER TYPE frostlink.user_permission_enum RENAME VALUE 'Technician' TO 'Intermediate';
ALTER TYPE frostlink.user_permission_enum RENAME VALUE 'User' TO 'Basic';

-- 2. Migrate Factory and Outlet users to Intermediate
UPDATE frostlink.users SET permissions = 'Intermediate' WHERE permissions = 'Factory';
UPDATE frostlink.users SET permissions = 'Intermediate' WHERE permissions = 'Outlet';

-- 3. Remove unused enum values (PostgreSQL 13+)
-- If on PG < 13, these will fail — you'd need to recreate the enum type instead.
ALTER TYPE frostlink.user_permission_enum RENAME VALUE 'Factory' TO '__deprecated_factory';
ALTER TYPE frostlink.user_permission_enum RENAME VALUE 'Outlet' TO '__deprecated_outlet';

-- Note: PostgreSQL does not support DROP VALUE from an enum.
-- The deprecated values are renamed with a __ prefix so they won't be used.
-- On a fresh database, schema.sql creates the enum with only the 4 active values.

COMMIT;
