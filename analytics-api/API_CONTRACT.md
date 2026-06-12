# API_CONTRACT — Analytics API

This document describes the Analytics API used by the Shpmarketing application for performance reporting.

For the Operations API, see [operations-api/API_CONTRACT.md](../operations-api/API_CONTRACT.md).

## Service Overview

- Service name: analytics-api
- Default local base URL: http://localhost:5002 (PORT env var)
- Content type: application/json
- CORS: configured by CORS_ORIGIN (comma-separated origins), credentials enabled
- Database: analytics PostgreSQL database, `public` schema (`performance_reports`, `tenants`, `iot_devices`)

## Authentication and Authorization

None. The service exposes read-only reporting endpoints with no auth layer of its own. Do not expose it publicly without an upstream gateway.

## Common Query Parameters

- `date`: report date, `YYYY-MM-DD` — must match an available value from `GET /filters/dates`
- `tenant`: tenant name from `GET /filters/tenants`, or the literal `ALL` to disable tenant filtering

Tenant scoping: a tenant maps to a set of IoT devices (`tenants.iot_device_ids` → `iot_devices.wi_fi_mac`); rows are filtered by `mac_address` membership in that set.

Active-unit filter: unless noted, metric endpoints only count rows where `is_active = true AND powered_hours_day > 0`.

## Endpoint Contract

## GET /health

Purpose: service health check (no DB check).

Response:

- 200: { "status": "ok" }

## GET /filters/dates

Purpose: list available report dates for filter dropdowns.

Responses:

- 200: array of `"YYYY-MM-DD"` strings, newest first
- 500: { "error": "Failed to load report dates" }

## GET /filters/tenants

Purpose: list active tenant names for filter dropdowns.

Responses:

- 200: array of tenant name strings, alphabetical
- 500: { "error": "Failed to load tenants" }

## GET /performance/summary

Purpose: headline metrics and fleet health segments for one report date and tenant.

Query params:

- date: required
- tenant: required

Responses:

- 200:
  {
    "total_units": 120,
    "active_powered_pct": 85.5,
    "avg_case_temp": 4.2,
    "avg_door_opens": 31,
    "avg_powered_pct": 92.3,
    "health_segments": [
      { "label": "Active & Powered On", "value": 100, "color": "#10b981" },
      { "label": "Active but Powered Off", "value": 10, "color": "#f59e0b" },
      { "label": "Inactive", "value": 10, "color": "#ef4444" }
    ]
  }
- 400: { "error": "date and tenant are required" }
- 500: { "error": "Failed to load performance summary" }

Notes:

- `total_units` and `health_segments` count all rows for the date/tenant (no active filter).
- Averages (`avg_case_temp`, `avg_door_opens`, `avg_powered_pct`) only include active, powered units; null when no matching rows.
- `active_powered_pct` = Active & Powered On count / total_units × 100, 1 decimal.

## GET /performance/distributions

Purpose: flag distributions (temperature, voltage risk, powered) for charts.

Query params:

- date: required
- tenant: required

Responses:

- 200:
  {
    "temp_flags": [ { "label": "OK", "value": 80 }, ... ],
    "voltage_flags": [ { "label": "Low Risk", "value": 70 }, ... ],
    "powered_flags": [ { "label": "Powered", "value": 90 }, ... ]
  }
- 400: { "error": "date and tenant are required" }
- 500: { "error": "Failed to load distributions" }

Notes:

- Active, powered units only.
- Rows with flag value `'N/A'` are excluded from each distribution.

## GET /performance/units

Purpose: per-unit table rows for one report date and tenant.

Query params:

- date: required
- tenant: required

Responses:

- 200: array ordered by door_opens DESC (nulls last):
  [
    {
      "mac_address": "AABBCC112233",
      "c_code": "C10001",
      "fridge_serial": "FR123",
      "district": "North",
      "powered_pct": 92.3,
      "powered_flag": "Powered",
      "avg_case_temp": 4.2,
      "temp_flag": "OK",
      "door_opens": 31,
      "voltage_avg": 228.1,
      "voltage_risk": "Low Risk",
      "latitude": -26.2,
      "longitude": 28.0,
      "last_active_date": "2026-06-10T00:00:00.000Z"
    }
  ]
- 400: { "error": "date and tenant are required" }
- 500: { "error": "Failed to load units" }

Notes:

- Active, powered units only.
- Numeric fields are null when missing in source data.

## GET /unit/:mac

Purpose: single unit detail for one report date.

Path params:

- mac: unit MAC address

Query params:

- date: required
- tenant: required

Responses:

- 200: same fields as a `/performance/units` row plus `is_active: boolean`
- 400: { "error": "date and tenant are required" }
- 404: { "error": "Unit not found for the selected date" }
- 500: { "error": "Failed to load unit detail" }

Notes:

- No active-unit filter — inactive units resolve too (tenant scope still applies).

## GET /unit/:mac/trends

Purpose: multi-date history series for unit detail charts.

Path params:

- mac: unit MAC address

Query params:

- tenant: required
- days: optional, number of most recent report dates (default 30, max 90)

Responses:

- 200:
  {
    "door_opens":  [ { "label": "2026-06-01", "value": 28 }, ... ],
    "temperature": [ { "label": "2026-06-01", "value": 4.1 }, ... ],
    "powered":     [ { "label": "2026-06-01", "value": 91.2 }, ... ],
    "voltage":     [ { "label": "2026-06-01", "value": 227.5 }, ... ]
  }
- 400: { "error": "tenant is required" }
- 500: { "error": "Failed to load unit trends" }

Notes:

- Series are ordered oldest → newest; null source values are returned as 0.
- Active, powered report rows only.

## Data Notes and Constraints

- Source table: `public.performance_reports` (one row per unit per report_date).
- `public.tenants.iot_device_ids` is an array of `public.iot_devices.id`; tenant filtering joins through `iot_devices.wi_fi_mac`.
- Flag columns (`temp_flag`, `voltage_risk`, `powered_flag`) are text labels and may be `'N/A'`.
- All endpoints are read-only; the service performs no writes.

## Operational Notes

- Errors are logged with a `[route]`-style prefix (e.g. `[performance/summary]`).
- Frontend consumes this service via `composables/useAnalyticsClient.ts`; base URL from `runtimeConfig.public.analyticsApiBase`.
