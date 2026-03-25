// Source of truth for user_permission_enum roles and role capabilities.
// Edit this file when you want to change what each role is allowed to do.

export const USER_PERMISSION_LEVELS = [
  "Admin",
  "Fleet Manager",
  "Technician",
  "User",
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
] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];
export type DataScope = "own_org" | "all_orgs";

type PermissionRolePolicy = {
  description: string;
  // Optional inheritance to avoid repeating shared capabilities.
  inherits?: PermissionLevel[];
  dataScope: DataScope;
  canFilterOrganisation?: boolean;
  grants: PermissionFlag[];
};

// Role policy matrix. Update grants/inheritance here as needed.
export const PERMISSION_POLICY: Record<PermissionLevel, PermissionRolePolicy> = {
  Admin: {
    description: "Full administrative access.",
    dataScope: "all_orgs",
    canFilterOrganisation: true,
    grants: [...PERMISSION_FLAGS],
  },
  "Fleet Manager": {
    description: "Can manage asset operations and resolution workflows.",
    dataScope: "own_org",
    inherits: ["Technician"],
    grants: [
      "assets.create",
      "assets.edit",
      "assets.delete",
      "users.view",
      "mismatches.resolve",
      "mismatches.delete",
    ],
  },
  Technician: {
    description: "Operational user focused on inventory, checks, and mismatch handling.",
    dataScope: "own_org",
    grants: [
      "assets.view",
      "history.view",
      "mismatches.view",
      "device_checker.submit",
    ],
  },
  User: {
    description: "Basic read-only user.",
    dataScope: "own_org",
    grants: ["assets.view"],
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
