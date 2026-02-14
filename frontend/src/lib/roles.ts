/**
 * Role-based access control constants and utilities
 */

// Role constants
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  COMPANY_ADMIN: "company_admin",
  BRANCH_MANAGER: "branch_manager",
  MARKETING_PERSON: "marketing_person",
  FINANCE_MANAGER: "finance_manager",
  LOGISTICS_MANAGER: "logistics_manager",
  DRIVER: "driver",
  USER: "user",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.COMPANY_ADMIN]: 80,
  [ROLES.FINANCE_MANAGER]: 60,
  [ROLES.LOGISTICS_MANAGER]: 60,
  [ROLES.BRANCH_MANAGER]: 50,
  [ROLES.MARKETING_PERSON]: 45,  // NEW: Marketing Person
  [ROLES.DRIVER]: 10,
  [ROLES.USER]: 5,
};

// Role ID to Role constant mapping (from backend role_id to frontend Role)
export const ROLE_ID_MAP: Record<number, Role> = {
  1: ROLES.SUPER_ADMIN, // "Super Admin"
  2: ROLES.COMPANY_ADMIN, // "Admin" -> maps to Company Admin
  3: ROLES.BRANCH_MANAGER, // "Branch Manager"
  4: ROLES.FINANCE_MANAGER, // "Finance Manager"
  5: ROLES.LOGISTICS_MANAGER, // "Logistics Manager"
  6: ROLES.DRIVER, // "Driver"
  7: ROLES.USER, // "User"
  8: ROLES.MARKETING_PERSON, // "Marketing Person" - NEW
};

// Role display names
export const ROLE_NAMES: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.COMPANY_ADMIN]: "Company Admin",
  [ROLES.BRANCH_MANAGER]: "Branch Manager",
  [ROLES.MARKETING_PERSON]: "Marketing Person",  // NEW
  [ROLES.FINANCE_MANAGER]: "Finance Manager",
  [ROLES.LOGISTICS_MANAGER]: "Logistics Manager",
  [ROLES.DRIVER]: "Driver",
  [ROLES.USER]: "User",
};

// Role-based route access
export const ROLE_ROUTES: Record<Role, string[]> = {
  [ROLES.SUPER_ADMIN]: [
    "/super-admin",
    // "/company-admin",
    // "/branch-manager",
    // "/finance-manager",
    // "/logistics-manager",
    // "/driver",
    // "/drivermodule", // Temporary renamed protected driver route
  ],
  [ROLES.COMPANY_ADMIN]: [
    "/company-admin",
    "/branch-manager",
    "/marketing-person",  // NEW
    "/finance-manager",
    "/logistics-manager",
  ],
  [ROLES.FINANCE_MANAGER]: ["/finance-manager"],
  [ROLES.LOGISTICS_MANAGER]: ["/logistics-manager"],
  [ROLES.BRANCH_MANAGER]: ["/branch-manager"],
  [ROLES.MARKETING_PERSON]: ["/marketing-person"],  // NEW
  [ROLES.DRIVER]: ["/drivermodule"], // Temporary renamed protected driver route
  [ROLES.USER]: [], // User role - no access yet (awaiting instructions)
};

// Analytics routes - accessible to all management roles
export const ANALYTICS_ROUTES: string[] = [
  "/company-admin/analytics",
  "/branch-manager/analytics",
  "/finance-manager/analytics",
  "/logistics-manager/analytics",
];

// Default redirect per role
export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "/super-admin/dashboard",
  [ROLES.COMPANY_ADMIN]: "/company-admin/masters",
  [ROLES.BRANCH_MANAGER]: "/branch-manager/dashboard",
  [ROLES.MARKETING_PERSON]: "/marketing-person/dashboard",
  [ROLES.FINANCE_MANAGER]: "/finance-manager/dashboard",
  [ROLES.LOGISTICS_MANAGER]: "/logistics-manager/trips-management",
  [ROLES.DRIVER]: "/drivermodule/trips", // Temporary renamed protected driver route
  [ROLES.USER]: "/user/profile", // Placeholder - will be updated with actual route
};

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: string | undefined,
  requiredRole: Role
): boolean {
  if (!userRole) return false;
  return userRole === requiredRole;
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(
  userRole: string | undefined,
  requiredRoles: Role[]
): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole as Role);
}

/**
 * Check if user role has higher or equal hierarchy level
 */
export function hasMinimumRole(
  userRole: string | undefined,
  minimumRole: Role
): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as Role] || 0;
  const minimumLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userLevel >= minimumLevel;
}

/**
 * Normalize role name to match our role constants
 * Handles variations like "Admin" -> "company_admin", "Branch Manager" -> "branch_manager"
 */
function normalizeRoleName(roleName: string | undefined): Role | undefined {
  if (!roleName) return undefined;

  // Direct mapping from auth service role names to frontend role constants
  const roleMapping: Record<string, Role> = {
    "super_admin": ROLES.SUPER_ADMIN,
    "admin": ROLES.COMPANY_ADMIN,
    "branch manager": ROLES.BRANCH_MANAGER,
    "branch_manager": ROLES.BRANCH_MANAGER,
    "marketing person": ROLES.MARKETING_PERSON,
    "marketing_person": ROLES.MARKETING_PERSON,
    "finance manager": ROLES.FINANCE_MANAGER,
    "finance_manager": ROLES.FINANCE_MANAGER,
    "logistics manager": ROLES.LOGISTICS_MANAGER,
    "logistics_manager": ROLES.LOGISTICS_MANAGER,
    "driver": ROLES.DRIVER,
    "user": ROLES.USER,
  };

  // Convert to lowercase and replace spaces/underscores
  const normalized = roleName.toLowerCase().replace(/[\s_-]+/g, "_");

  // Check direct mapping first
  if (roleMapping[normalized]) {
    return roleMapping[normalized];
  }

  // Check if it matches any of our role constants
  const roleValues = Object.values(ROLES);
  const matchedRole = roleValues.find((r) => r === normalized);

  if (matchedRole) {
    return matchedRole;
  }

  // Try to find by partial match (e.g., "companyadmin" -> "company_admin")
  for (const role of roleValues) {
    if (
      normalized.includes(role.replace("_", "")) ||
      role.replace("_", "").includes(normalized)
    ) {
      return role;
    }
  }

  return undefined;
}

/**
 * Get accessible routes for a role
 */
export function getAccessibleRoutes(userRole: string | undefined): string[] {
  if (!userRole) return [];
  const normalizedRole = normalizeRoleName(userRole);
  if (!normalizedRole) return [];
  return ROLE_ROUTES[normalizedRole] || [];
}

/**
 * Check if user can access a route
 */
export function canAccessRoute(
  userRole: string | undefined,
  route: string
): boolean {
  if (!userRole) return false;

  const normalizedRole = normalizeRoleName(userRole);
  if (!normalizedRole) {
    // If role can't be normalized, allow access to prevent infinite loops
    // Log a warning for debugging
    console.warn(
      `Unknown role format: "${userRole}". Allowing access to prevent redirect loop.`
    );
    return true;
  }

  // Super admin can access everything
  if (normalizedRole === ROLES.SUPER_ADMIN) return true;

  const accessibleRoutes = getAccessibleRoutes(userRole);
  return accessibleRoutes.some((r) => route.startsWith(r));
}

/**
 * Get default route for user role
 */
export function getDefaultRoute(userRole: string | undefined): string {
  if (!userRole) return "/login";
  const normalizedRole = normalizeRoleName(userRole);
  if (!normalizedRole) return "/company-admin/masters";
  return ROLE_DEFAULT_ROUTE[normalizedRole] || "/company-admin/masters";
}

/**
 * Get role constant from role_id (from backend)
 */
export function getRoleFromId(roleId: number | undefined): Role | undefined {
  if (!roleId) return undefined;
  return ROLE_ID_MAP[roleId];
}

/**
 * Get user role from API response (prioritizes role_name over role_id)
 * role_name is consistent across tenants while role_id is tenant-specific
 */
export function getUserRole(user: {
  role_id?: number | string;
  role_name?: string;
  role?: { name?: string } | string;
}): Role | undefined {
  // First try to get role from role_name (consistent across tenants)
  if (user.role_name) {
    const normalizedRole = normalizeRoleName(user.role_name);
    if (normalizedRole) return normalizedRole;
  }

  // Fallback to role object name
  if (typeof user.role === "string") {
    return normalizeRoleName(user.role);
  } else if (user.role?.name) {
    return normalizeRoleName(user.role.name);
  }

  // Last resort: try role_id (only for legacy/superadmin where IDs are consistent)
  // Note: This will NOT work for tenant-specific roles
  if (user.role_id) {
    const roleId = typeof user.role_id === "string" ? parseInt(user.role_id) : user.role_id;
    const roleFromId = getRoleFromId(roleId);
    if (roleFromId) return roleFromId;
  }

  return undefined;
}
