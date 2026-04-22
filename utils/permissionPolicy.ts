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
  "users.manage",
  "users.view",
  "assets.create",
  "assets.edit",
  "assets.delete",
  "assets.view",
  "mismatches.resolve",
  "mismatches.delete",
  "mismatches.view",
  "history.view",
  "device_checker.submit",
  "placement.submit",
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
    description: "Full administrative access.",
    dataScope: "all_orgs",
    canFilterOrganisation: true,
    grants: [...PERMISSION_FLAGS],
  },
  Advanced: {
    description: "Can manage asset operations and resolution workflows.",
    dataScope: "own_org",
    grants: [
      "users.manage",
      "users.view",
      "assets.create",
      "assets.edit",
      "assets.delete",
      "assets.view",
      "mismatches.resolve",
      "mismatches.delete",
      "mismatches.view",
      "history.view",
      "device_checker.submit",
      "placement.submit",
    ],
  },
  Intermediate: {
    description: "Operational user focused on checks and mismatch handling.",
    dataScope: "own_org",
    grants: [
      "mismatches.view",
      "device_checker.submit",
      "placement.submit",
    ],
  },
  Basic: {
    description: "Read-only access to inventory, mismatches, and history.",
    dataScope: "own_org",
    grants: [
      "assets.view",
      "mismatches.view",
      "history.view",
    ],
  },
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
  return getPermissionLevelRank(targetLevel) >= getPermissionLevelRank(actorLevel);
}
