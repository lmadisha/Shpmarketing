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
- permissions: Admin | Intermediate | Basic

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
- permissions: Admin | Intermediate | Basic (required)

Responses:

- 201:
  {
    "token": "...",
    "user": {
      "id": 1,
      "username": "user@example.com",
      "full_name": "User Name",
      "permissions": "Basic"
    }
  }
- 400: missing fields, invalid permission, short password
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
      "permissions": "Admin"
    }
  }
- 401: invalid credentials
- 403: user inactive
- 500: server error

## GET /users

Purpose: list users.

Auth: Bearer + Admin.

Responses:

- 200: array of users with id, username, full_name, permissions, is_active, created_at
- 401/403
- 500

## POST /users

Purpose: create user (admin action).

Auth: Bearer + Admin.

Input body:

- username: string (required)
- password: string (required)
- full_name: string (required)
- permissions: Admin | Intermediate | Basic (required)

Responses:

- 200: created user row
- 400: missing fields or invalid permissions
- 409: duplicate username/email
- 401/403
- 500

## PUT /users/:id/permissions

Purpose: update user permissions.

Auth: Bearer + Admin.

Input body:

- permissions: Admin | Intermediate | Basic

Responses:

- 200: updated user row
- 400: invalid permissions
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
- 401
- 500: { "error": "create-device failed: ..." }

Notes:

- Runs in transaction.
- Sets myapp.current_user_id for audit trigger context.

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
- Serial length is not validated by parser.
- Invalid MAC values are converted to null.
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
      "failedRows": 2
    },
    "inserted": [ ...fridgeRows... ],
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

- DB unique conflicts are captured as DUPLICATE_IN_DB and do not abort the whole bulk operation.
- Uses a single transaction for inserts.

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

Responses:

- 200: array of fridge rows
- 401
- 500: { "error": "list-fridges failed: ..." }

## GET /searchFridges

Purpose: search fridges by serial, MAC, or C-number.

Auth: Bearer.

Query params:

- searchTerm: string

Responses:

- 200: array of fridge rows
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
- 401
- 500: { "error": "update-device failed: ..." }

## DELETE /deleteDevice/:serialNumber

Purpose: delete fridge by serial.

Auth: Bearer.

Responses:

- 200: { "message": "Fridge deleted successfully", "device": { ... } }
- 404: fridge not found
- 401
- 500: { "error": "delete-device failed: ..." }

## GET /auditLog/:serialNumber

Purpose: device-specific audit history.

Auth: Bearer.

Responses:

- 200: array ordered by changed_at DESC
- 401
- 500: { "error": "device-history failed: ..." }

## GET /auditLog

Purpose: global audit history.

Auth: Bearer.

Responses:

- 200: array ordered by changed_at DESC
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

## GET /mismatches

Purpose: list mismatch records.

Auth: Bearer.

Query params:

- status: open | resolved | deleted | all (default open)
- from: YYYY-MM-DD (optional)
- to: YYYY-MM-DD (optional)
- serial: string (optional, partial match)

Responses:

- 200: array ordered by received_at DESC, max 500 rows
- 401
- 500: { "error": "list-mismatches failed: ..." }

## PUT /mismatches/:id/resolve

Purpose: resolve mismatch, optionally apply received values to fridge.

Auth: Bearer.

Input body:

- applyToFridge: boolean (default false)
- setVerified: boolean (default true)
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

## Fallback Route

Any unknown route returns:

- 404: { "error": "Route not found: <METHOD> <PATH>" }

## Data Notes and Constraints

- fridges.fridge_serial_number is a primary key in database schema.
- fridges.iot_mac_address is unique (including partial unique index for non-empty values).
- Fridge change auditing is trigger-based via fridge_audit_log.

## Operational Notes

- API logs include action-level markers prefixed with [asset-manager].
- Bulk upload logs include file metadata and parsed row counts.
- Ensure the running process is started from the repository's operations-api directory so latest routes are active.
