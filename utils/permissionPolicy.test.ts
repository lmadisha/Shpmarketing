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

  it("describes Basic placement as serial-scan-only without MAC capture", () => {
    expect(PERMISSION_POLICY.Basic.description).toContain("Bluetooth");
    expect(PERMISSION_POLICY.Basic.description).toContain("serial barcode");
    expect(PERMISSION_POLICY.Basic.description).toContain("without MAC entry");
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
