# Add Fridge Optional Identifiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow fridge records to be created and updated without a MAC address or C-number by persisting missing optional identifiers as `NULL` instead of empty strings, and surface useful duplicate/conflict errors in the admin UI.

**Architecture:** Keep the database schema unchanged and fix the write semantics in the API. The `frostlink.fridges.iot_mac_address` unique index already allows multiple `NULL` values, so the main change is to stop writing `""` for missing optional identifiers. Use one small backend helper for nullable persistence, apply it to every fridge write path, then tighten the add-fridge UI error handling so backend validation and duplicate errors are visible.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Nuxt 3, Vue 3, `node:test`

---

### Task 1: Add Backend Regression Coverage For Nullable Optional Identifiers

**Files:**
- Modify: `operations-api/asset-validation.js`
- Modify: `operations-api/test/asset-validation.test.js`
- Test: `operations-api/test/asset-validation.test.js`

- [ ] **Step 1: Write the failing tests**

Add two tests to `operations-api/test/asset-validation.test.js` before changing implementation:

```js
test("toNullableAssetIdentifier converts blank optional identifiers to null", () => {
  assert.equal(toNullableAssetIdentifier(""), null);
  assert.equal(toNullableAssetIdentifier("   "), null);
  assert.equal(toNullableAssetIdentifier(null), null);
  assert.equal(toNullableAssetIdentifier(undefined), null);
  assert.equal(toNullableAssetIdentifier("AABBCC"), "AABBCC");
});

test("validateAssetIdentifiers still allows blank optional MAC and C-number values", () => {
  const errors = validateAssetIdentifiers(
    {
      fridge_serial_number: "ABC123DEF456",
      mac_address: "",
      c_number: "",
    },
    {
      serial_min_length: 12,
      serial_max_length: 12,
      mac_min_length: 12,
      mac_max_length: 12,
      c_number_min_length: 10,
      c_number_max_length: 10,
    },
    { requireSerial: true },
  );

  assert.equal(errors.fridge_serial_number, undefined);
  assert.equal(errors.mac_address, undefined);
  assert.equal(errors.c_number, undefined);
});
```

- [ ] **Step 2: Run the focused test file to verify it fails**

Run:

```bash
npm.cmd test -- test/asset-validation.test.js
```

Expected: FAIL with `ReferenceError` or import failure for `toNullableAssetIdentifier`.

- [ ] **Step 3: Add the minimal helper to backend validation utilities**

Update `operations-api/asset-validation.js`:

```js
function toNullableAssetIdentifier(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

module.exports = {
  DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES,
  MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS,
  normalizeHexIdentifier,
  normalizeCNumber,
  parseLocationCoordinates,
  toNullableAssetIdentifier,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
};
```

Also update the test imports in `operations-api/test/asset-validation.test.js`:

```js
const {
  normalizeHexIdentifier,
  normalizeCNumber,
  parseLocationCoordinates,
  toNullableAssetIdentifier,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
} = require("../asset-validation");
```

- [ ] **Step 4: Run the focused test file to verify it passes**

Run:

```bash
npm.cmd test -- test/asset-validation.test.js
```

Expected: PASS with all tests green in that file.

- [ ] **Step 5: Commit**

```bash
git add operations-api/asset-validation.js operations-api/test/asset-validation.test.js
git commit -m "test(operations-api): cover nullable optional fridge identifiers"
```

### Task 2: Persist Missing Optional Identifiers As NULL Across Fridge Write Paths

**Files:**
- Modify: `operations-api/server.js:1777-1836`
- Modify: `operations-api/server.js:2087-2149`
- Modify: `operations-api/server.js:2330-2376`
- Modify: `operations-api/server.js:3148-3205`
- Test: `operations-api/test/asset-validation.test.js`

- [ ] **Step 1: Extend the test file with a focused persistence helper assertion**

Add one more test to `operations-api/test/asset-validation.test.js`:

```js
test("normalized optional identifiers can be safely prepared for nullable persistence", () => {
  const mac = normalizeHexIdentifier("");
  const cNumber = normalizeCNumber("");

  assert.equal(toNullableAssetIdentifier(mac), null);
  assert.equal(toNullableAssetIdentifier(cNumber), null);
  assert.equal(toNullableAssetIdentifier(normalizeHexIdentifier("aa-bb-cc")), "AABBCC");
});
```

- [ ] **Step 2: Run the focused test file to verify it still fails for the intended reason**

Run:

```bash
npm.cmd test -- test/asset-validation.test.js
```

Expected: FAIL only if the helper wiring or imports are incomplete. If Task 1 is already complete, this step should pass immediately and you can continue.

- [ ] **Step 3: Replace empty-string writes with nullable writes in every fridge create/update path**

Update `operations-api/server.js` imports:

```js
const {
  DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES,
  normalizeHexIdentifier,
  normalizeCNumber,
  parseLocationCoordinates,
  toNullableAssetIdentifier,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
} = require("./asset-validation");
```

Then apply the helper to all fridge persistence writes that currently use `|| ""`:

```js
return await tx.fridge.create({
  data: {
    fridgeSerialNumber: fridge_serial_number,
    iotMacAddress: toNullableAssetIdentifier(mac_address),
    cNumber: toNullableAssetIdentifier(c_number),
    organisationId,
  },
});
```

```js
const result = await prisma.fridge.update({
  where: { fridgeSerialNumber: serial },
  data: {
    iotMacAddress: toNullableAssetIdentifier(mac),
    cNumber: toNullableAssetIdentifier(cNumber),
    ...(shouldUnverify ? { verified: false, verifiedAt: null } : {}),
  },
});
```

```js
return await tx.fridge.update({
  where: {
    fridgeSerialNumber: req.params.serialNumber,
    ...(scope.effectiveOrganisationId != null ? { organisationId: scope.effectiveOrganisationId } : {}),
  },
  data: {
    iotMacAddress: toNullableAssetIdentifier(nextMac),
    cNumber: toNullableAssetIdentifier(nextCNumber),
    ...(shouldUnverify ? { verified: false, verifiedAt: null } : {}),
  },
});
```

```js
await tx.fridge.create({
  data: {
    fridgeSerialNumber: serial,
    iotMacAddress: toNullableAssetIdentifier(nextMac),
    cNumber: toNullableAssetIdentifier(cNum),
    organisationId: scope.effectiveOrganisationId,
    placed: true,
    latitude,
    longitude,
  },
});
```

```js
await tx.fridge.update({
  where: { fridgeSerialNumber: serial },
  data: {
    iotMacAddress: toNullableAssetIdentifier(nextMac),
    cNumber: toNullableAssetIdentifier(cNum),
    placed: true,
    latitude,
    longitude,
  },
});
```

Do not change the validation behavior. Blank optional values should remain valid; only persistence should change.

- [ ] **Step 4: Add explicit duplicate/conflict handling to the create route**

In the `/newDevice` catch block in `operations-api/server.js`, add a duplicate handler before `handleAssetError(...)`:

```js
if (error.code === "P2002" || error.code === "23505") {
  return res.status(400).json({
    error: "A fridge with the same serial number or MAC address already exists.",
  });
}
```

Use the same pattern already present elsewhere in `server.js` for uniqueness errors so add-fridge returns a user-facing `400` instead of a generic `500`.

- [ ] **Step 5: Run the API test suite**

Run:

```bash
npm.cmd test
```

Expected: PASS with all `operations-api` tests green.

- [ ] **Step 6: Commit**

```bash
git add operations-api/server.js operations-api/asset-validation.js operations-api/test/asset-validation.test.js
git commit -m "fix(operations-api): store optional fridge identifiers as null"
```

### Task 3: Show Real Add-Fridge Errors In The Admin UI

**Files:**
- Modify: `pages/admin/assets/add.vue:120-152`
- Modify: `composables/useApiClient.ts` (read-only check; no code change expected)
- Test: manual verification in browser

- [ ] **Step 1: Confirm the client already exposes backend error strings**

Read `composables/useApiClient.ts` and confirm this block remains intact:

```ts
if (!response.ok) {
  const structuredMessage =
    (data &&
      typeof data === "object" &&
      (("message" in data && String((data as Record<string, unknown>).message)) ||
        ("error" in data && String((data as Record<string, unknown>).error)))) ||
    "";

  throw new Error(String(structuredMessage || fallbackMessage || "Request failed"));
}
```

No code change is required here unless this behavior has drifted.

- [ ] **Step 2: Change the add-fridge form to preserve the backend error message**

Update the catch block in `pages/admin/assets/add.vue`:

```ts
  } catch (error) {
    createResult.value =
      error instanceof Error
        ? error.message
        : "Could not add fridge. Check duplicates and try again.";
  } finally {
    creating.value = false;
  }
```

Keep the success path unchanged.

- [ ] **Step 3: Run available automated tests**

Run:

```bash
cd operations-api
npm.cmd test
```

Expected: PASS. There is no existing frontend test harness in this repo for `pages/admin/assets/add.vue`, so backend test coverage plus manual QA is the verification path for this task.

- [ ] **Step 4: Perform manual verification in the admin UI**

Use the add-fridge form in `pages/admin/assets/add.vue` and verify:

```text
1. Add a fridge with serial only, blank MAC, blank C-number -> should succeed.
2. Add a second fridge with serial only, blank MAC, blank C-number -> should also succeed.
3. Add a fridge with duplicate serial -> should fail with the API duplicate message.
4. Add a fridge with duplicate MAC -> should fail with the API duplicate message.
5. Edit an existing fridge and clear MAC/C-number -> should save without reintroducing empty-string conflicts.
```

- [ ] **Step 5: Commit**

```bash
git add pages/admin/assets/add.vue
git commit -m "fix(admin-assets): show create-fridge API errors"
```

### Task 4: Final Verification And Rollout Check

**Files:**
- Modify: none
- Test: `operations-api/test/asset-validation.test.js`
- Test: manual admin asset flows

- [ ] **Step 1: Run the full backend test suite from a clean shell**

Run:

```bash
cd operations-api
npm.cmd test
```

Expected: PASS with zero failing tests.

- [ ] **Step 2: Re-read the touched write paths in `operations-api/server.js`**

Confirm there are no remaining fridge persistence writes using empty-string fallbacks like:

```js
iotMacAddress: someValue || ""
cNumber: someValue || ""
```

The target write paths to verify are:

```text
/newDevice
/newDevice/bulk/update
/updateDevice/:serialNumber
placement/manual fridge create/update flow
```

- [ ] **Step 3: Sanity-check the admin UI messaging**

Verify `pages/admin/assets/add.vue` still shows:

```text
- "Fridge added successfully." on success
- precise backend error text on duplicate/conflict failure
- unchanged validation messages for serial/MAC/C-number length rules
```

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add .
git commit -m "chore: verify nullable fridge identifier flow"
```

## Self-Review

- Spec coverage: The plan covers the root cause in fridge creation, adjacent write paths that can reintroduce empty strings, and the UI masking that currently hides backend conflicts.
- Placeholder scan: No `TODO` or unresolved placeholders remain.
- Type consistency: The plan consistently uses `toNullableAssetIdentifier(value)` as the single nullable persistence helper across backend write paths.
