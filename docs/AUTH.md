# Authentication & Authorization

How identity and permissions work across the platform. The **operations-api is the enforcement point**; the frontend mirrors the model for UX only. Role→permission mapping table: [permission-role-matrix.md](permission-role-matrix.md).

## Auth models

| Model | Used by | Header | Credential |
|---|---|---|---|
| User JWT (Bearer) | Frontend → operations-api (most routes) | `Authorization: Bearer <token>` | `JWT_SECRET` |
| Mobile API key | Mobile client → `POST /mobile/verify` | `x-api-key: <key>` | `MOBILE_API_KEY` |
| None | analytics-api (all routes) | — | — (must sit behind a gateway if exposed) |

Both secrets are **boot-required**: operations-api `server.js` calls `process.exit(1)` if `JWT_SECRET` or `MOBILE_API_KEY` is unset.

## JWT (user auth)

**Issued by** `POST /login` and `POST /signup`. Signed with `jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" })`.

Payload:
```json
{ "id": <number>, "username": "<email>", "permissions": "Admin|Advanced|Intermediate|Basic" }
```

Login/signup response:
```json
{ "token": "<jwt>", "user": { "id", "username", "full_name", "permissions", "organisation_id" } }
```

**Verified by** the `requireAuth` middleware: reads the Bearer token, `jwt.verify(token, JWT_SECRET)`, attaches the decoded payload to `req.user`.
- `401 { "error": "Missing token" }` — no Bearer token.
- `401 { "error": "Invalid token" }` — verify failed/expired.

**Passwords** are hashed with **bcrypt, 12 rounds** (login check, user creation, password reset).

**Login errors:** `401 Invalid username or password`, `401 User is inactive`.

## Mobile API key

`requireMobileKey` middleware compares `x-api-key` to `MOBILE_API_KEY`; mismatch → `401 { "error": "Invalid mobile api key" }`. Only `POST /mobile/verify` uses it (no JWT). Used by the field/mobile flow to verify fridge identifiers and create mismatches.

## Rate limiting

`express-rate-limit` on `POST /login` and `POST /signup`: **window 15 min, max 20 / IP**, `429 { "error": "Too many login attempts, please try again later." }`.

## Permission model

Four hierarchical levels, each **inheriting** the grants of the level below:

```
Admin ──inherits──▶ Advanced ──inherits──▶ Intermediate ──inherits──▶ Basic
(rank 0)            (rank 1)               (rank 2)                    (rank 3)
```
Lower rank number = higher authority. Defined in backend `server.js` and mirrored in `apps/frontend/utils/permissionPolicy.ts`.

**Direct grants per level** (cumulative via inheritance):

| Level | Adds (beyond inherited) | Data scope | Can filter org? |
|---|---|---|---|
| **Basic** | `assets.view`, `mismatches.view`, `history.view`, `device_checker.view`, `device_checker.submit_scan_only`, `placement.view`, `placement.submit_scan_only` | own org | no |
| **Intermediate** | `workspace.view`, `users.assign_basic`, `assets.create`, `assets.edit`, `assets.download`, `mismatches.download`, `history.download`, `device_checker.submit`, `placement.submit` | own org | no |
| **Advanced** | `users.manage`, `users.view`, `assets.bulk_add`, `assets.delete`, `mismatches.resolve`, `mismatches.delete`, `users.assign_intermediate`, `users.assign_advanced`, `profile.edit_details`, `organisation_asset_validation.manage` | own org | no |
| **Admin** | `assets.bulk_delete`, `users.assign_admin`, `organisations.manage` | **all orgs** | **yes** |

Full flag list also in `permission-role-matrix.md`. Enum names are stored with underscores in the DB and serialized back to spaces in API responses (`serializePermission`).

### Enforcement (backend)
- `requirePermission(flag)` — `403 { "error": "Permission required: <flag>" }` if the resolved grant set lacks the flag; `401 Missing user context` if no `req.user`.
- `requireAnyPermission([...])` — passes if the user has any listed flag, else `403 Any of these permissions required: …`.
- `hasUserPermission(user, flag)` / `resolvePermissionGrants(level)` — resolve the full inherited grant set.

### Role management guards
- `canTargetRole(actor, target)` — Admin can target Admin-and-lower; non-admins only **strictly lower** ranks.
- `canAssignPermissionLevel(user, level)` — requires the matching `users.assign_<level>` flag.
- `canManageTargetUser` — must pass **both** of the above.
- Errors: `403 You do not have permission to manage this role.`, `403 You do not have permission to assign this role.`

### Organisation scoping
- `resolveOrganisationScope` (reads) / `resolveOrganisationMutationScope` (writes): **non-admins are locked to their own `organisation_id`**; admins may pass `organisation_id` to filter, or `all`/omit for no filter (writes fall back to the admin's own org).
- `parseRequestedOrganisationId`: `all`/null → no filter; invalid/≤0 → `INVALID_ORGANISATION_FILTER`.
- Non-admin without a configured org → error.

## Frontend handling

- **Store** (`stores/auth.ts`): `login`/`signup`/`logout`, session persisted to `sessionStorage` under key `shpmarketing.auth` (`{ token, user }`).
- **Hydration**: `plugins/auth.client.ts` calls `hydrateFromStorage()` at startup; invalid/empty storage is cleared; `isHydrated` gates redirects.
- **API client** (`composables/useApiClient.ts`): injects `Authorization: Bearer <token>`; on **401** calls `logout()` and throws "Your session has expired. Please sign in again."; on **403** surfaces the server message or "You do not have permission for this action."
- **Route guards**: `middleware/auth.ts` redirects unauthenticated users to `/login`; `middleware/guest.ts` redirects authenticated users away from login/signup to `/admin/assets/inventory`.
- **Policy mirror** (`utils/permissionPolicy.ts`): `hasPermission`, `resolveGrants`, `getDataScope`, `canFilterOrganisation`, `canTargetPermissionLevel`, `getRoleAssignmentFlag` — used to show/hide UI. **Not a security boundary** — the API re-checks everything.

## Keeping front/back in sync

The permission flags, levels, inheritance, and org-scoping rules exist in **two places** (`server.js` and `utils/permissionPolicy.ts`). When changing roles or grants, update both, and the matrix doc. `utils/permissionPolicy.test.ts` covers the frontend policy.
