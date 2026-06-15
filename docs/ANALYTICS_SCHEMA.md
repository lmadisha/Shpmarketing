# Analytics Database Schema

Reference for the **analytics database** (`shpmarketing_analytics`, `public` schema) read by `apps/analytics-api`. This database is separate from the operational `frostlink` database ([SCHEMA.md](../apps/operations-api/database/schema/SCHEMA.md)).

The analytics-api has **no migrations of its own** in-repo — the schema is owned by the database (created/maintained externally, populated by stored procedures from raw `iot_telemetry`). Columns below are CONFIRMED where DDL was found in `database_details/`, otherwise INFERRED from query usage in `apps/analytics-api/server.js` and the reference SQL under `database_details/`.

## Entity relationships

```
tenants.iot_device_ids[] ─┐
                          ▼
                    iot_devices.id ──< iot_telemetry.iot_device_id >── iot_datasources.id
                          │                     (raw time series)
   iot_devices.wi_fi_mac ─┴──────────────┐
                                         ▼
        performance_reports.mac_address  │   (daily aggregate, 1 row / device / day)
        maintenance_report.mac_address ──┘   (daily diagnostics)
```

The API's core scoping join: `performance_reports.mac_address` → (devices whose `id` is in `tenants.iot_device_ids`) `iot_devices.wi_fi_mac`.

## Tables read by analytics-api

### performance_reports
Daily performance metrics, one row per device per day. **Primary source for all `/performance/*` and `/unit/*` endpoints.** PK: `(report_date, fridge_serial)`.

| Column | Type | Meaning |
|---|---|---|
| report_date | date | Report day (PK) |
| fridge_serial | text | Fridge serial (PK) |
| mac_address | text | Device WiFi MAC → `iot_devices.wi_fi_mac` |
| c_code | text | Signal Hill C-number |
| district | text | Geographic district |
| is_active | boolean | Device reported data that day |
| powered_hours_day | numeric | Hours powered on |
| powered_pct | numeric | % of day powered (0–100) |
| powered_flag | text | Power status label (`Green`/`Orange`/`Red`/`N/A`) |
| avg_case_temp_c | numeric | Average cabinet temp °C |
| temp_flag | text | Temperature label (`Green`/`Red`/`N/A`) |
| door_opens_count | integer | Door-open events that day |
| voltage_avg_day | numeric | Average mains voltage |
| voltage_risk | text | Voltage risk label (`OK`/`Medium`/`High`/`N/A`) |
| last_active_date | date | Last date device was active |
| latitude | numeric | GPS latitude (null when inactive/off) |
| longitude | numeric | GPS longitude (null when inactive/off) |

> Active-unit filter used by most endpoints: `is_active = true AND powered_hours_day > 0`.

### tenants
Logical grouping of devices for multi-tenant report filtering. PK: `id`.

| Column | Type | Meaning |
|---|---|---|
| id | bigint | Tenant id (PK) |
| name | text | Tenant name (unique; used as the `tenant` query param) |
| description | text | Description |
| iot_device_ids | bigint[] | Array of `iot_devices.id` in this tenant |
| active | boolean | Only `active = true` tenants are listed by `/filters/tenants` |
| create_timestamp / updated_timestamp | timestamptz | Audit timestamps |

> The literal tenant value `ALL` in the API bypasses the device-membership filter.

### iot_devices
Master device registry. PK: `id`. Unique: `staycold_serial`.

| Column | Type | Meaning |
|---|---|---|
| id | bigint | Device id (PK); referenced by `tenants.iot_device_ids` |
| wi_fi_mac | text | WiFi MAC → `performance_reports.mac_address` |
| staycold_serial | text | Fridge serial → `performance_reports.fridge_serial` |
| signal_hill_c_number | text | C-number → `performance_reports.c_code` |
| name, firmware_version, imei, imsi, apn, iccid, sim_provider, cell_number | text | Device/SIM metadata |
| customer_name, district, address_1/2/3 | text | Location/customer metadata |
| in_trade, billable | boolean | Lifecycle/billing flags |
| iot_device_serial | text | Enclosure barcode serial |
| staycold_dispatch_date, dt_shipping_date | date | Logistics dates |
| create_timestamp, last_seen | timestamptz | Creation / last telemetry time |
| asset_force_latitude, asset_force_longitude | double precision | External GPS source |

## Supporting tables (data pipeline)

These feed the reports above; the analytics-api does not query most directly but they explain where the data comes from. Mappings to telemetry datasources are INFERRED from `database_details/` function code.

| Table | Purpose | PK |
|---|---|---|
| maintenance_report | Daily compressor/condenser diagnostics (`diffcon`, `severity`, trend temps); powers the maintenance report | (mac_address, report_date) |
| iot_telemetry | Raw time-series sensor values (`timestamp`, `datasource_id`, `iot_device_id`, `value` text) | — |
| iot_datasources | Sensor-type registry mapping `datasource_id` → key/name + Modbus + scaling | id |
| telemetry_3h_bins | 3-hour aggregated cabinet/compressor/condenser temps + door state; 7-day rolling window for trends | (mac_address, bin_ts) |
| precomputed_door_count_data | Monthly door-open counts per device | (iot_device_id, month) |
| precomputed_mains_data | Monthly mains-availability counts per device | (iot_device_id, month) |
| precomputed_temperature_data | Monthly in-spec (≤4 °C) temperature counts per device | (iot_device_id, month) |
| latest_values | Most recent reading per (device, datasource) | (iot_device_id, datasource_id) |
| gps_history | EWMA-smoothed GPS track, last ~10 samples per device | id |
| schema_metadata | Schema version/config key-value | key |

### Telemetry datasource IDs (INFERRED from query usage)
`28` longitude · `29` latitude · `30` GPS accuracy · `31` setpoint temp · `32` cabinet avg temp · `33` condenser temp · `40` mains voltage · `41/42` evaporator temps · `44/45` upper/lower setpoint · `48` door state (0/1) · `79` cabinet avg (variant) · `80/81` cabinet max/min · `82/83/84` compressor avg/max/min.

## Notes

- All analytics-api access is **read-only**; writes are done by database stored procedures (`sp_generate_daily_performance_report`, `refresh_maintenance_report_for_day`, `refresh_telemetry_3h_bins_for_day`, `fn_recompute_continuous_aggregates`, GPS triggers).
- Flag columns are free text and may be `N/A`; the API excludes `N/A` from distribution charts.
- This doc is hand-maintained — there is no `schema:extract` for the analytics DB. Update it when the upstream schema or stored procedures change.
