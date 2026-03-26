# API_CONTRACT

This document describes the Operations API used by the Shpmarketing application.

## Service Overview

- Service name: operations-api
- Default local base URL: http://localhost:5001
- Content type: application/json unless noted
- CORS: configured by CORS_ORIGIN and local dev origin fallback

## Authentication and Authorization

### Auth models

- User JWT auth (Bearer token): required for most endpoints
- Mobile API key auth: only for mobile verification endpoint

### Headers

- Bearer auth: Authorization: Bearer <token>
- Mobile key: x-api-key: <MOBILE_API_KEY>

### JWT payload fields

- id: number
- username: string
- permissions: Admin | Fleet Manager | Factory | Outlet | Technician | User

### Common auth-related responses

- 401 Missing token
- 401 Invalid token
- 403 Admin permission required (admin-only routes)
- 403 Not allowed (password change for non-self/non-admin)

## Rate Limiting

The following endpoints are rate-limited (express-rate-limit):

- POST /signup
- POST /login

Limit settings:

- window: 15 minutes
- max: 20 requests per window
- on limit: 429 with { "error": "Too many login attempts, please try again later." }

## Endpoint Contract

## GET /health

Purpose: service and DB health check.

Auth: none.

Response:

- 200: { "ok": true, "service": "operations-api" }
- 500: { "ok": false, "error": "DB_UNAVAILABLE" }

## POST /signup

Purpose: create user account and return JWT session.

Auth: none.

Input body:

- username: string (required)
- password: string (required, min 8)
- full_name: string (required)
- permissions: Admin | Fleet Manager | Factory | Outlet | Technician | User (required)
- organisation_id: number (required)

Responses:

- 201:
  {
    "token": "...",
    "user": {
      "id": 1,
      "username": "user@example.com",
      "full_name": "User Name",
      "permissions": "User",
      "organisation_id": 2
    }
  }
- 400: missing fields, invalid permission, short password, invalid/missing organisation_id, organisation not found
- 409: { "error": "That email/username already exists" }
- 500: { "error": "Server Error" }

## POST /login

Purpose: authenticate user and return JWT session.

Auth: none.

Input body:

- username: string
- password: string

Responses:

- 200:
  {
    "token": "...",
    "user": {
      "id": 1,
      "username": "user@example.com",
      "full_name": "User Name", 
      "permissions": "Admin",
      "organisation_id": 2
    }
  }
- 401: invalid credentials
- 403: user inactive
- 500: server error

## GET /organisations

Purpose: list organisations for signup selection and workspace management UIs.

Auth: none.

Responses:

- 200: array of { id, name, domin }
- 500: { "error": "Server Error" }

## POST /organisations

Purpose: create a new organisation.

Auth: Bearer + Admin.

Input body:

- name: string (required, unique)
- domin: string | null (optional, unique when present)

Responses:

- 201: created organisation row `{ id, name, domin, created_at }`
- 400: missing name
- 401/403
- 409: duplicate name/domin
- 500: { "error": "Server Error" }

## DELETE /organisations/:id

Purpose: delete an organisation when it has no linked users/fridges.

Auth: Bearer + Admin.

Responses:

- 200: `{ deleted: true, organisation: { id, name } }`
- 400: invalid organisation id
- 401/403
- 404: organisation not found
- 409: linked users/fridges exist (includes `users_count`, `fridges_count`)
- 500: { "error": "Server Error" }

## GET /profile

Purpose: fetch authenticated user profile details from operations DB.

Auth: Bearer.

Responses:

- 200:
  {
    "id": 3,
    "username": "user@example.com",
    "full_name": "User Name",
    "first_name": "User",
    "last_name": "Name",
    "permissions": "Fleet Manager",
    "organisation_id": 2,
    "organisation_name": "Org Name",
    "organisation_domin": "org.com"
  }
- 404: profile not found
- 401
- 500: { "error": "Server Error" }

## PUT /profile

Purpose: update authenticated user profile details (excluding permissions).

Auth: Bearer.

Input body:

- username: string (required)
- first_name: string (optional)
- last_name: string (optional)

Notes:

- `permissions` and `organisation_id` are not editable through this endpoint.
- `full_name` is derived server-side from `first_name` + `last_name`.

Responses:

- 200: updated profile payload (same shape as `GET /profile`)
- 400: invalid/missing input
- 401
- 404: profile not found
- 409: duplicate username/email
- 500: { "error": "Server Error" }

## GET /users

Purpose: list users.

Auth: Bearer + `users.view`.

Query params:

- organisation_id: number | `all` (optional)

Scope behavior:

- Admin: can view all users or filter to one organisation.
- Non-admin: always restricted to own organisation regardless of query param.
- For callers with `users.view`, response includes only users at caller level or lower.

Responses:

- 200: array of users with id, username, full_name, permissions, is_active, created_at, organisation_id, organisation_name
- 400: invalid organisation filter or missing caller organisation assignment
- 401/403
- 500

## POST /users

Purpose: create user.

Auth: Bearer + `users.manage`.

Input body:

- username: string (required)
- password: string (required)
- full_name: string (required)
- permissions: Admin | Fleet Manager | Factory | Outlet | Technician | User (required)
- organisation_id: number (optional)

Responses:

- 200: created user row
- 400: missing fields or invalid permissions
- 403: non-admin managers cannot create users outside their own organisation, and callers cannot assign roles above their own level
- 409: duplicate username/email
- 401/403
- 500

## PUT /users/:id/permissions

Purpose: update user permissions.

Auth: Bearer + `users.manage`.

Input body:

- permissions: Admin | Fleet Manager | Factory | Outlet | Technician | User

Responses:

- 200: updated user row
- 400: invalid permissions or invalid user id
- 403: caller cannot assign roles above own level or modify users above own level
- 404: user not found
- 401/403
- 500

## PUT /users/:id/password

Purpose: change password (self or admin).

Auth: Bearer.

Input body:

- new_password: string (min 8)

Responses:

- 200: { "message": "Password updated" }
- 400: password too short
- 403: not allowed
- 404: user not found
- 401
- 500

## POST /newDevice

Purpose: create one fridge record.

Auth: Bearer.

Input body:

- fridge_serial_number: string
- mac_address: string | null
- c_number: string | null

Responses:

- 200: inserted fridge row
- 400: { "error": "User organisation is not configured." }
- 401
- 500: { "error": "create-device failed: ..." }

Notes:

- Runs in transaction.
- Sets myapp.current_user_id for audit trigger context.
- Fridge `organisation_id` is derived from authenticated user (`users.organisation_id`) on server side.

## POST /newDevice/bulk

Purpose: bulk insert fridges from uploaded file.

Auth: Bearer.

Request format:

- multipart/form-data
- field name: file
- accepted file types: CSV/XLS/XLSX
- max file size: 5 MB

Parsing and sanitization behavior:

- Serial is required per row (non-empty after trim).
- Rows with empty serial are excluded.
- Serial is truncated to 12 characters.
- MAC is cleaned to hex and truncated to 12 characters; empty becomes null.
- Invalid C-number values are converted to null.
- Duplicate serials in same file are rejected.

Recognized serial headers (normalized):

- fridge_serial_number
- fridge serial number
- fridgeserial
- serial
- serial_number
- serialnumber
- assetserial

Recognized MAC headers:

- mac_address
- mac
- iot_mac_address
- devicemac

Recognized C-number headers:

- c_number
- cnum
- cnumber
- customernumber

Responses:

- 200:
  {
    "ok": true,
    "summary": {
      "totalRows": 100,
      "excludedRows": 5,
      "validRows": 90,
      "insertedRows": 88,
      "skippedRows": 1,
      "failedRows": 2
    },
    "inserted": [ ...fridgeRows... ],
    "skippedRows": [
      {
        "rowNumber": 11,
        "serial": "ABC123",
        "reason": "DUPLICATE_IN_DB",
        "message": "Serial number already exists in database."
      }
    ],
    "errors": [
      {
        "rowNumber": 14,
        "serial": "ABC123",
        "reason": "DUPLICATE_IN_FILE",
        "message": "Duplicate serial in uploaded file."
      }
    ]
  }
- 400: invalid upload, parse failure, no data rows, no valid rows
- 401
- 500: { "error": "bulk-upload failed: ..." }

Notes:

- Fridge `organisation_id` is derived from authenticated user (`users.organisation_id`) on server side.
- DB duplicates are skipped and reported in `skippedRows`.
- Row-level insert errors are reported in `errors` without aborting entire bulk run.

## POST /newDevice/bulk/preview

Purpose: preview uploaded rows before insertion.

Auth: Bearer.

Request format:

- multipart/form-data
- field name: file

Behavior:

- Uses same parser and sanitization logic as POST /newDevice/bulk.
- Excludes rows without serial.
- Returns sanitized values (invalid MAC/C-number shown as null).

Responses:

- 200:
  {
    "ok": true,
    "columns": ["rowNumber", "fridge_serial_number", "mac_address", "c_number"],
    "summary": {
      "totalRows": 100,
      "previewRows": 95,
      "excludedRows": 5
    },
    "rows": [
      {
        "rowNumber": 2,
        "fridge_serial_number": "FR123",
        "mac_address": "001122AABBCC",
        "c_number": "C10001"
      }
    ]
  }
- 400: invalid upload, parse failure, no data rows
- 401
- 500: { "error": "bulk-preview failed: ..." }

## GET /getFridges

Purpose: list all fridges.

Auth: Bearer.

Query params:

- organisation_id: number | "all" (optional, admin-only filter)

Responses:

- 200: array of fridge rows
- 400: invalid organisation filter or user organisation not configured
- 401
- 500: { "error": "list-fridges failed: ..." }

Notes:

- Non-admin users are always scoped to their own `users.organisation_id`.
- Admin users can see all organisations by default and may pass `organisation_id` to filter.

## GET /searchFridges

Purpose: search fridges by serial, MAC, or C-number.

Auth: Bearer.

Query params:

- searchTerm: string
- organisation_id: number | "all" (optional, admin-only filter)

Responses:

- 200: array of fridge rows
- 400: invalid organisation filter or user organisation not configured
- 401
- 500: { "error": "search-fridges failed: ..." }

## PUT /updateDevice/:serialNumber

Purpose: update fridge MAC/C-number.

Auth: Bearer.

Input body:

- mac_address: string | null
- c_number: string | null

Responses:

- 200: updated fridge row
- 404: no fridge found
- 400: user organisation not configured (non-admin)
- 401
- 500: { "error": "update-device failed: ..." }

## DELETE /deleteDevice/:serialNumber

Purpose: delete fridge by serial.

Auth: Bearer.

Responses:

- 200: { "message": "Fridge deleted successfully", "device": { ... } }
- 404: fridge not found
- 400: user organisation not configured (non-admin)
- 401
- 500: { "error": "delete-device failed: ..." }

## GET /auditLog/:serialNumber

Purpose: device-specific audit history.

Auth: Bearer.

Query params:

- organisation_id: number | "all" (optional, admin-only filter)

Responses:

- 200: array ordered by changed_at DESC; includes `changed_by_username`
- 400: invalid organisation filter or user organisation not configured
- 401
- 500: { "error": "device-history failed: ..." }

## GET /auditLog

Purpose: global audit history.

Auth: Bearer.

Query params:

- organisation_id: number | "all" (optional, admin-only filter)

Responses:

- 200: array ordered by changed_at DESC; includes `changed_by_username`
- 400: invalid organisation filter or user organisation not configured
- 401
- 500: { "error": "audit-history failed: ..." }

## POST /mobile/verify

Purpose: verify fridge data from mobile flow and create mismatches when needed.

Auth: x-api-key.

Input body:

- fridge_serial_number: string (required)
- mac_address: string (optional)
- c_number: string (optional)

Responses:

- 200 verified:
  { "ok": true, "result": "VERIFIED", "fridge": { ... } }
- 200 mismatch created (not found or value mismatch):
  {
    "ok": false,
    "result": "MISMATCH_CREATED",
    "reason": "NOT_FOUND" | "VALUE_MISMATCH",
    "mismatch": { ... }
  }
- 400: missing fridge_serial_number
- 401: invalid mobile api key
- 500: { "error": "mobile-verify failed: ..." }

## POST /mismatches/manual

Purpose: submit a manual device check from the admin UI.

Auth: Bearer.

Input body:

- fridge_serial_number: string (required)
- mac_address: string (required)
- c_number: string (required)

Responses:

- 200 verified:
  {
    "ok": true,
    "result": "VERIFIED",
    "fridge_serial_number": "FR123...",
    "fridge": { ...updated fridge row... }
  }
- 200 mismatch created:
  {
    "ok": true,
    "result": "MISMATCH_CREATED",
    "id": 1,
    "fridge_serial_number": "FR123...",
    "mismatch": { ...inserted mismatch row... },
    "fridge": { ...updated fridge row... } | null
  }
- 400: missing fridge_serial_number, mac_address, or c_number
- 404: fridge not found
- 401
- 500: { "error": "submit-manual-mismatch failed: ..." }

Notes:

- If submitted MAC and C-number match the fridge row:
  no mismatch is inserted; fridge is updated with `verified=true` and `verified_at=NOW()`.
- If submitted values do not match:
  inserts a mismatch row with status `open`, `db_mac`, `db_c_number`, and `sender_id`.
- On mismatch, if the fridge was previously verified:
  fridge is updated with `verified=false` and `verified_at=NOW()`.
- Runs in transaction with `myapp.current_user_id` set for audit trigger context.
- sender_id is set to req.user.id (the authenticated user who submitted).
- Non-admin users can only submit against fridges in their own organisation.

## GET /mismatches

Purpose: list mismatch records.

Auth: Bearer.

Query params:

- status: open | resolve | cancel | delete | all (default open)
- from: YYYY-MM-DD (optional)
- to: YYYY-MM-DD (optional)
- serial: string (optional, partial match)
- organisation_id: number | "all" (optional, admin-only filter)

Responses:

- 200: array ordered by received_at DESC, max 500 rows
- 400: invalid status or organisation filter
- 401
- 500: { "error": "list-mismatches failed: ..." }

## PUT /mismatches/:id/resolve

Purpose: resolve mismatch and automatically apply received values to fridge.

Auth: Bearer.

Input body:

- note: string (optional)

Responses:

- 200:
  {
    "ok": true,
    "mismatch": { ...resolved row... },
    "fridge": { ...updated row... } | null
  }
- 400: invalid id
- 404: mismatch not found
- 401
- 500: { "error": "resolve-mismatch failed: ..." }

Notes:

- On resolve, server updates fridge `iot_mac_address` and `c_number` from mismatch `received_mac` and `received_c_number` (when present).
- On resolve, server always sets fridge `verified = true` and `verified_at = NOW()`.
- Non-admin users can only resolve mismatches that belong to their own organisation.

## DELETE /mismatches/:id

Purpose: soft-delete a mismatch.

Auth: Bearer.

Input body:

- note: string (required)

Responses:

- 200: { "ok": true, "mismatch": { ... } }
- 400: invalid id or missing note
- 404: mismatch not found
- 401
- 500: { "error": "delete-mismatch failed: ..." }

Notes:

- Non-admin users can only delete mismatches that belong to their own organisation.

## Fallback Route

Any unknown route returns:

- 404: { "error": "Route not found: <METHOD> <PATH>" }

## Data Notes and Constraints

- fridges.fridge_serial_number is a primary key in database schema.
- fridges.iot_mac_address is unique (including partial unique index for non-empty values).
- users.permissions is an enum: Admin | Fleet Manager | Factory | Outlet | Technician | User.
- organisation has optional `domin` column (unique when provided).
- Fridge change auditing is trigger-based via fridge_audit_log.
- fridge_mismatches.sender_id references users(id) and records the admin user who manually submitted the mismatch via POST /mismatches/manual.

## Operational Notes

- API logs include action-level markers prefixed with [asset-manager].
- Bulk upload logs include file metadata and parsed row counts.
- Ensure the running process is started from the repository's operations-api directory so latest routes are active.
