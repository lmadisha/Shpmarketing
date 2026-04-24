// Source of truth for user_permission_enum roles and role capabilities.
// Edit this file when you want to change what each role is allowed to do.

export const USER_PERMISSION_LEVELS = [
  "Admin",
  "Advanced",
  "Intermediate",
  "Basic",
] as const;

export type PermissionLevel = (typeof USER_PERMISSION_LEVELS)[number];

export const PERMISSION_FLAGS = [
  "workspace.view",
  "users.view",
  "users.manage",
  "users.assign_basic",
  "users.assign_intermediate",
  "users.assign_advanced",
  "users.assign_admin",
  "organisations.manage",
  "profile.edit_details",
  "organisation_asset_validation.manage",
  "assets.create",
  "assets.edit",
  "assets.delete",
  "assets.bulk_add",
  "assets.bulk_delete",
  "assets.download",
  "assets.view",
  "mismatches.resolve",
  "mismatches.delete",
  "mismatches.download",
  "mismatches.view",
  "history.view",
  "history.download",
  "device_checker.view",
  "device_checker.submit",
  "device_checker.submit_scan_only",
  "placement.view",
  "placement.submit",
  "placement.submit_scan_only",
] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];
export type DataScope = "own_org" | "all_orgs";

const permissionLevelRankEntries = USER_PERMISSION_LEVELS.map((level, index) => [level, index] as const);
export const PERMISSION_LEVEL_RANK = Object.fromEntries(permissionLevelRankEntries) as Record<PermissionLevel, number>;

type PermissionRolePolicy = {
  description: string;
  inherits?: PermissionLevel[];
  dataScope: DataScope;
  canFilterOrganisation?: boolean;
  grants: PermissionFlag[];
};

export const PERMISSION_POLICY: Record<PermissionLevel, PermissionRolePolicy> = {
  Admin: {
    description: "Full administrative access, including peer-admin workspace management.",
    dataScope: "all_orgs",
    canFilterOrganisation: true,
    inherits: ["Advanced"],
    grants: [
      "assets.bulk_delete",
      "users.assign_admin",
      "organisations.manage",
    ],
  },
  Advanced: {
    description: "Can manage advanced asset operations and workspace users below Advanced.",
    dataScope: "own_org",
    inherits: ["Intermediate"],
    grants: [
      "users.manage",
      "users.view",
      "assets.bulk_add",
      "assets.delete",
      "mismatches.resolve",
      "mismatches.delete",
      "users.assign_intermediate",
      "users.assign_advanced",
      "profile.edit_details",
      "organisation_asset_validation.manage",
    ],
  },
  Intermediate: {
    description: "Operational user with workspace access limited to Basic users.",
    dataScope: "own_org",
    inherits: ["Basic"],
    grants: [
      "workspace.view",
      "users.assign_basic",
      "assets.create",
      "assets.edit",
      "assets.download",
      "mismatches.download",
      "history.download",
      "device_checker.submit",
      "placement.submit",
    ],
  },
  Basic: {
    description: "Read-only access to inventory, mismatches, and history. Can submit device checks and placements via scanner/Bluetooth only.",
    dataScope: "own_org",
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
};

export const ROLE_ASSIGNMENT_FLAG_BY_LEVEL: Record<PermissionLevel, PermissionFlag> = {
  Basic: "users.assign_basic",
  Intermediate: "users.assign_intermediate",
  Advanced: "users.assign_advanced",
  Admin: "users.assign_admin",
};

function resolveGrants(level: PermissionLevel, visited = new Set<PermissionLevel>()): Set<PermissionFlag> {
  if (visited.has(level)) {
    return new Set();
  }
  visited.add(level);

  const policy = PERMISSION_POLICY[level];
  const grants = new Set<PermissionFlag>(policy.grants);

  for (const inheritedLevel of policy.inherits || []) {
    const inheritedGrants = resolveGrants(inheritedLevel, visited);
    inheritedGrants.forEach((grant) => grants.add(grant));
  }

  return grants;
}

export function hasPermission(level: PermissionLevel, flag: PermissionFlag): boolean {
  return resolveGrants(level).has(flag);
}

export function listPermissions(level: PermissionLevel): PermissionFlag[] {
  return Array.from(resolveGrants(level)).sort();
}

export function getDataScope(level: PermissionLevel): DataScope {
  return PERMISSION_POLICY[level].dataScope;
}

export function canFilterOrganisation(level: PermissionLevel): boolean {
  return Boolean(PERMISSION_POLICY[level].canFilterOrganisation);
}

export function getPermissionLevelRank(level: PermissionLevel): number {
  return PERMISSION_LEVEL_RANK[level];
}

export function canTargetPermissionLevel(actorLevel: PermissionLevel, targetLevel: PermissionLevel): boolean {
  const actorRank = getPermissionLevelRank(actorLevel);
  const targetRank = getPermissionLevelRank(targetLevel);

  if (actorLevel === "Admin") {
    return targetRank >= actorRank;
  }

  return targetRank > actorRank;
}

export function getRoleAssignmentFlag(level: PermissionLevel): PermissionFlag {
  return ROLE_ASSIGNMENT_FLAG_BY_LEVEL[level];
}
