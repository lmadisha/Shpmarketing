# Permission Policy Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the failing permission test and eliminate frontend/backend permission model drift by syncing `submit_scan_only` flags across both policy files.

**Architecture:** The frontend (`utils/permissionPolicy.ts`) and backend (`operations-api/server.js`) each maintain their own permission policy. Both must define the same `PERMISSION_FLAGS` and grant the same flags to the same roles. Scan-based submissions use a mobile API key route (`/mobile/verify`), not JWT routes, so no route changes are needed — only the flag registries and role grants need syncing.

**Tech Stack:** TypeScript (frontend policy + Vitest tests), Node.js/Express (backend policy)

---

## File Map

| File | Change |
|------|--------|
| `utils/permissionPolicy.test.ts` | Fix failing test expectation for `Basic` role |
| `operations-api/server.js` | Add `submit_scan_only` flags to `PERMISSION_FLAGS` and `Basic` grants |

---

### Task 1: Fix the failing test in `permissionPolicy.test.ts`

**Context:** The test `keeps Basic as read-only/view-only operations` expects Basic to have only 5 view-only flags. But the frontend policy grants Basic two additional scan-only submit flags: `device_checker.submit_scan_only` and `placement.submit_scan_only`. The description in `permissionPolicy.ts` for Basic explicitly says "Can submit device checks and placements via scanner/Bluetooth only" — confirming these flags are intentional. The test expectation is stale, not the policy.

**Files:**
- Modify: `utils/permissionPolicy.test.ts:18-29`

- [ ] **Step 1: Update the test expectation and description to match actual Basic policy**

Replace the `keeps Basic as read-only/view-only operations` test body:

```typescript
it("keeps Basic as limited-submission role (view + scan-only submit)", () => {
  const basicPermissions = new Set(listPermissions("Basic"));
  expect(basicPermissions).toEqual(
    new Set([
      "assets.view",
      "mismatches.view",
      "history.view",
      "device_checker.view",
      "device_checker.submit_scan_only",
      "placement.view",
      "placement.submit_scan_only",
    ]),
  );
});
```

The full updated file (`utils/permissionPolicy.test.ts`):

```typescript
import { describe, expect, it } from "vitest";
import {
  canTargetPermissionLevel,
  getRoleAssignmentFlag,
  hasPermission,
  listPermissions,
  type PermissionLevel,
} from "./permissionPolicy";

describe("permission policy alignment", () => {
  it("maps role assignment flags explicitly", () => {
    expect(getRoleAssignmentFlag("Basic")).toBe("users.assign_basic");
    expect(getRoleAssignmentFlag("Intermediate")).toBe("users.assign_intermediate");
    expect(getRoleAssignmentFlag("Advanced")).toBe("users.assign_advanced");
    expect(getRoleAssignmentFlag("Admin")).toBe("users.assign_admin");
  });

  it("keeps Basic as limited-submission role (view + scan-only submit)", () => {
    const basicPermissions = new Set(listPermissions("Basic"));
    expect(basicPermissions).toEqual(
      new Set([
        "assets.view",
        "mismatches.view",
        "history.view",
        "device_checker.view",
        "device_checker.submit_scan_only",
        "placement.view",
        "placement.submit_scan_only",
      ]),
    );
  });

  it("gives Intermediate workspace access limited to basic-role assignment", () => {
    const level: PermissionLevel = "Intermediate";
    expect(hasPermission(level, "workspace.view")).toBe(true);
    expect(hasPermission(level, "users.assign_basic")).toBe(true);
    expect(hasPermission(level, "users.assign_intermediate")).toBe(false);
    expect(hasPermission(level, "assets.bulk_add")).toBe(false);
    expect(hasPermission(level, "assets.download")).toBe(true);
    expect(hasPermission(level, "history.download")).toBe(true);
    expect(hasPermission(level, "mismatches.download")).toBe(true);
  });

  it("keeps organisation management and admin assignment as admin-only", () => {
    expect(hasPermission("Advanced", "organisations.manage")).toBe(false);
    expect(hasPermission("Advanced", "users.assign_admin")).toBe(false);
    expect(hasPermission("Admin", "organisations.manage")).toBe(true);
    expect(hasPermission("Admin", "users.assign_admin")).toBe(true);
  });

  it("restricts same-level workspace targeting to admins only", () => {
    expect(canTargetPermissionLevel("Intermediate", "Intermediate")).toBe(false);
    expect(canTargetPermissionLevel("Advanced", "Advanced")).toBe(false);
    expect(canTargetPermissionLevel("Advanced", "Intermediate")).toBe(true);
    expect(canTargetPermissionLevel("Advanced", "Basic")).toBe(true);
    expect(canTargetPermissionLevel("Admin", "Admin")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test suite to verify all 5 tests pass**

Run: `npx vitest run utils/permissionPolicy.test.ts`

Expected output:
```
✓ utils/permissionPolicy.test.ts (5)
  ✓ permission policy alignment > maps role assignment flags explicitly
  ✓ permission policy alignment > keeps Basic as limited-submission role (view + scan-only submit)
  ✓ permission policy alignment > gives Intermediate workspace access limited to basic-role assignment
  ✓ permission policy alignment > keeps organisation management and admin assignment as admin-only
  ✓ permission policy alignment > restricts same-level workspace targeting to admins only

Test Files  1 passed (1)
Tests       5 passed (5)
```

- [ ] **Step 3: Commit**

```bash
git add utils/permissionPolicy.test.ts
git commit -m "fix: update Basic permission test to include scan-only submit flags"
```

---

### Task 2: Sync backend `PERMISSION_FLAGS` to include scan-only flags

**Context:** `operations-api/server.js` line 176 defines `PERMISSION_FLAGS`. It currently omits `device_checker.submit_scan_only` and `placement.submit_scan_only`. The `hasUserPermission` function at line 328 returns `false` for any flag not in `PERMISSION_FLAGS`, so these flags are silently invalid on the backend. Adding them to `PERMISSION_FLAGS` makes them valid backend-recognized flags even if no route currently gates on them.

**Files:**
- Modify: `operations-api/server.js:176-204`

- [ ] **Step 1: Add the two missing flags to `PERMISSION_FLAGS` in server.js**

Find this block at line 200-203 in `operations-api/server.js`:

```javascript
  "device_checker.view",
  "device_checker.submit",
  "placement.view",
  "placement.submit",
]);
```

Replace with:

```javascript
  "device_checker.view",
  "device_checker.submit",
  "device_checker.submit_scan_only",
  "placement.view",
  "placement.submit",
  "placement.submit_scan_only",
]);
```

- [ ] **Step 2: Verify the change looks right**

Run: `node -e "const s = require('./operations-api/server.js')" 2>&1 | head -5`

Expected: server starts without errors (or exits early due to missing env vars — that's fine). The goal is no parse errors.

Actually, since server.js requires env vars and will `process.exit(1)`, use this instead:

```bash
node -e "
const src = require('fs').readFileSync('operations-api/server.js', 'utf8');
const match = src.match(/const PERMISSION_FLAGS = Object\.freeze\(\[([\s\S]*?)\]\)/);
console.log(match[1].trim());
"
```

Expected: output includes both `"device_checker.submit_scan_only"` and `"placement.submit_scan_only"`.

---

### Task 3: Sync backend `Basic` role grants to include scan-only flags

**Context:** `operations-api/server.js` line 249-258 defines the `Basic` role grants. They currently omit `device_checker.submit_scan_only` and `placement.submit_scan_only`, diverging from the frontend `PERMISSION_POLICY`. The mobile scan route (`/mobile/verify`) uses API key auth and does not check JWT permissions, so no route guard changes are needed. Adding these flags to the backend Basic grants keeps the policy in sync and allows future backend enforcement if a scan-keyed JWT route is added.

**Files:**
- Modify: `operations-api/server.js:249-258`

- [ ] **Step 1: Add scan-only grants to Basic role in server.js**

Find this block at line 249-258 in `operations-api/server.js`:

```javascript
  Basic: {
    inherits: [],
    grants: [
      "assets.view",
      "mismatches.view",
      "history.view",
      "device_checker.view",
      "placement.view",
    ],
  },
```

Replace with:

```javascript
  Basic: {
    inherits: [],
    grants: [
      "assets.view",
      "mismatches.view",
      "history.view",
      "device_checker.view",
      "device_checker.submit_scan_only",
      "placement.view",
      "placement.submit_scan_only",
    ],
  },
```

- [ ] **Step 2: Add a test to confirm Basic scan-only alignment between frontend and backend**

Add a new test to `utils/permissionPolicy.test.ts` that documents the expected policy divergence points (routes that require `submit` but not `submit_scan_only`). Actually, the better check is a comment in server.js noting that the mobile route bypasses permission checks. Add this comment directly above the `/mobile/verify` route:

Find at line 2856 in `operations-api/server.js`:

```javascript
app.post("/mobile/verify", requireMobileKey, async (req, res) => {
```

Replace with:

```javascript
// Uses API key auth (requireMobileKey), not JWT. Basic users with submit_scan_only
// reach this route via mobile device, not via JWT-guarded routes.
app.post("/mobile/verify", requireMobileKey, async (req, res) => {
```

- [ ] **Step 3: Commit**

```bash
git add operations-api/server.js
git commit -m "fix: sync backend permission flags and Basic grants with frontend policy"
```

---

### Task 4: Add a cross-policy alignment test to prevent future drift

**Context:** The drift happened because two independent permission registries exist. A test that cross-checks them prevents future divergence without requiring a shared module.

**Files:**
- Modify: `utils/permissionPolicy.test.ts`

- [ ] **Step 1: Add drift-guard assertions to the test file**

Add this new `describe` block at the end of `utils/permissionPolicy.test.ts`:

```typescript
describe("policy completeness", () => {
  it("grants no flag that is not in PERMISSION_FLAGS", () => {
    const { PERMISSION_FLAGS: flags, PERMISSION_POLICY: policy } = await import("./permissionPolicy");
    for (const [level, rule] of Object.entries(policy)) {
      for (const grant of rule.grants) {
        expect(
          (flags as readonly string[]).includes(grant),
          `${level} grants unknown flag "${grant}"`,
        ).toBe(true);
      }
    }
  });
});
```

Wait — `PERMISSION_POLICY` is not currently exported. Check the exports in `utils/permissionPolicy.ts`.

Looking at the exports:
- `PERMISSION_FLAGS` — exported ✓
- `PERMISSION_POLICY` — NOT exported

- [ ] **Step 1a: Export PERMISSION_POLICY from `utils/permissionPolicy.ts`**

Find line 59 in `utils/permissionPolicy.ts`:

```typescript
export const PERMISSION_POLICY: Record<PermissionLevel, PermissionRolePolicy> = {
```

It is already `export const PERMISSION_POLICY` — it IS exported. Good.

- [ ] **Step 1b: Add the drift-guard test**

At the bottom of `utils/permissionPolicy.test.ts`, before the closing `});` of the outer `describe`, add:

```typescript
  it("grants no flag that is not registered in PERMISSION_FLAGS", () => {
    const { PERMISSION_FLAGS: flags, PERMISSION_POLICY: policy } = require("./permissionPolicy");
    for (const [level, rule] of Object.entries(policy as Record<string, { grants: string[] }>)) {
      for (const grant of rule.grants) {
        expect(
          (flags as readonly string[]).includes(grant),
          `${level} directly grants unregistered flag "${grant}"`,
        ).toBe(true);
      }
    }
  });
```

Actually — since this is a Vitest ESM environment using `import`, use a static import. Add the imports at the top of the test file:

```typescript
import {
  canTargetPermissionLevel,
  getRoleAssignmentFlag,
  hasPermission,
  listPermissions,
  PERMISSION_FLAGS,
  PERMISSION_POLICY,
  type PermissionLevel,
} from "./permissionPolicy";
```

Then add this test inside the `describe` block:

```typescript
  it("grants no flag that is not registered in PERMISSION_FLAGS", () => {
    for (const [level, rule] of Object.entries(PERMISSION_POLICY)) {
      for (const grant of rule.grants) {
        expect(
          (PERMISSION_FLAGS as readonly string[]).includes(grant),
          `${level} directly grants unregistered flag "${grant}"`,
        ).toBe(true);
      }
    }
  });
```

The full final `utils/permissionPolicy.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  canTargetPermissionLevel,
  getRoleAssignmentFlag,
  hasPermission,
  listPermissions,
  PERMISSION_FLAGS,
  PERMISSION_POLICY,
  type PermissionLevel,
} from "./permissionPolicy";

describe("permission policy alignment", () => {
  it("maps role assignment flags explicitly", () => {
    expect(getRoleAssignmentFlag("Basic")).toBe("users.assign_basic");
    expect(getRoleAssignmentFlag("Intermediate")).toBe("users.assign_intermediate");
    expect(getRoleAssignmentFlag("Advanced")).toBe("users.assign_advanced");
    expect(getRoleAssignmentFlag("Admin")).toBe("users.assign_admin");
  });

  it("keeps Basic as limited-submission role (view + scan-only submit)", () => {
    const basicPermissions = new Set(listPermissions("Basic"));
    expect(basicPermissions).toEqual(
      new Set([
        "assets.view",
        "mismatches.view",
        "history.view",
        "device_checker.view",
        "device_checker.submit_scan_only",
        "placement.view",
        "placement.submit_scan_only",
      ]),
    );
  });

  it("gives Intermediate workspace access limited to basic-role assignment", () => {
    const level: PermissionLevel = "Intermediate";
    expect(hasPermission(level, "workspace.view")).toBe(true);
    expect(hasPermission(level, "users.assign_basic")).toBe(true);
    expect(hasPermission(level, "users.assign_intermediate")).toBe(false);
    expect(hasPermission(level, "assets.bulk_add")).toBe(false);
    expect(hasPermission(level, "assets.download")).toBe(true);
    expect(hasPermission(level, "history.download")).toBe(true);
    expect(hasPermission(level, "mismatches.download")).toBe(true);
  });

  it("keeps organisation management and admin assignment as admin-only", () => {
    expect(hasPermission("Advanced", "organisations.manage")).toBe(false);
    expect(hasPermission("Advanced", "users.assign_admin")).toBe(false);
    expect(hasPermission("Admin", "organisations.manage")).toBe(true);
    expect(hasPermission("Admin", "users.assign_admin")).toBe(true);
  });

  it("restricts same-level workspace targeting to admins only", () => {
    expect(canTargetPermissionLevel("Intermediate", "Intermediate")).toBe(false);
    expect(canTargetPermissionLevel("Advanced", "Advanced")).toBe(false);
    expect(canTargetPermissionLevel("Advanced", "Intermediate")).toBe(true);
    expect(canTargetPermissionLevel("Advanced", "Basic")).toBe(true);
    expect(canTargetPermissionLevel("Admin", "Admin")).toBe(true);
  });

  it("grants no flag that is not registered in PERMISSION_FLAGS", () => {
    for (const [level, rule] of Object.entries(PERMISSION_POLICY)) {
      for (const grant of rule.grants) {
        expect(
          (PERMISSION_FLAGS as readonly string[]).includes(grant),
          `${level} directly grants unregistered flag "${grant}"`,
        ).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run all tests to confirm 6 pass**

Run: `npx vitest run utils/permissionPolicy.test.ts`

Expected:
```
Test Files  1 passed (1)
Tests       6 passed (6)
```

- [ ] **Step 3: Commit**

```bash
git add utils/permissionPolicy.test.ts
git commit -m "test: add drift-guard to catch unregistered permission flags in grants"
```

---

## Self-Review

### Spec coverage

| Finding | Task |
|---------|------|
| Fix failing test | Task 1 |
| Add `submit_scan_only` to backend `PERMISSION_FLAGS` | Task 2 |
| Add `submit_scan_only` to backend Basic grants | Task 3 |
| Prevent future drift | Task 4 |

### Risks

- No route changes are needed. `/mobile/verify` uses `requireMobileKey` (API key), not JWT — Basic users submit scans through it without needing any JWT permission flag. The `submit_scan_only` flags are semantic markers, not route guards.
- The drift-guard test in Task 4 only checks frontend grants against frontend `PERMISSION_FLAGS`. It does not cross-check against the backend. A true cross-check would require a shared module or a separate integration test in `operations-api/`. That is out of scope here but noted as a follow-up.
