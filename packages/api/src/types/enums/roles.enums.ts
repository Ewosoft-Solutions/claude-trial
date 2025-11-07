/**
 * Role and Permission Enums
 *
 * Enums related to roles, permissions, and access control.
 */

/**
 * System Role Names
 *
 * All system-defined roles in the platform.
 */
export enum SystemRole {
  ARCHITECT = 'Architect',
  SUPER_ADMIN = 'SuperAdmin',
  OWNER = 'Owner',
  MANAGEMENT = 'Management',
  IT_SUPPORT = 'ITSupport',
  FINANCE = 'Finance',
  OPERATIONS = 'Operations',
  TEACHER = 'Teacher',
  PARENT = 'Parent',
  STUDENT = 'Student',
  GUEST = 'Guest',
}

/**
 * Platform Role Names
 *
 * Platform-level administrative roles.
 */
export enum PlatformRole {
  ARCHITECT = 'Architect',
  SUPER_ADMIN = 'SuperAdmin',
  PLATFORM_ADMIN = 'PlatformAdmin',
}

/**
 * Role Type
 *
 * Defines whether a role is platform-level, system-level, or custom.
 */
export enum RoleType {
  PLATFORM = 'platform',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

/**
 * Clearance Levels
 *
 * Numeric clearance levels (0-10) with named constants.
 * Higher numbers indicate higher privileges.
 */
export const ClearanceLevel = {
  GUEST: 0,
  STUDENT: 1,
  PARENT: 2,
  TEACHER: 3,
  OPERATIONS: 4,
  FINANCE: 5,
  IT_SUPPORT: 6,
  MANAGEMENT: 7,
  OWNER: 8,
  SUPER_ADMIN: 9,
  ARCHITECT: 10,
} as const;

/**
 * Clearance Level Type
 */
export type ClearanceLevelType =
  (typeof ClearanceLevel)[keyof typeof ClearanceLevel];

/**
 * Helper functions for clearance level checks
 */
export const ClearanceLevelHelpers = {
  /**
   * Check if a clearance level is platform-level (9-10)
   */
  isPlatformLevel(level: number): boolean {
    return level >= ClearanceLevel.SUPER_ADMIN;
  },

  /**
   * Check if a clearance level is school-level (0-8)
   */
  isSchoolLevel(level: number): boolean {
    return level < ClearanceLevel.SUPER_ADMIN;
  },

  /**
   * Check if a clearance level is architect (10)
   */
  isArchitect(level: number): boolean {
    return level === ClearanceLevel.ARCHITECT;
  },

  /**
   * Check if a clearance level is super admin or higher (9-10)
   */
  isSuperAdminOrHigher(level: number): boolean {
    return level >= ClearanceLevel.SUPER_ADMIN;
  },

  /**
   * Check if a clearance level is owner or higher (8-10)
   */
  isOwnerOrHigher(level: number): boolean {
    return level >= ClearanceLevel.OWNER;
  },

  /**
   * Check if a clearance level is management or higher (7-10)
   */
  isManagementOrHigher(level: number): boolean {
    return level >= ClearanceLevel.MANAGEMENT;
  },

  /**
   * Check if a clearance level is teacher or higher (3-10)
   */
  isTeacherOrHigher(level: number): boolean {
    return level >= ClearanceLevel.TEACHER;
  },
};

/**
 * Permission check mode
 */
export enum PermissionMode {
  ALL = 'all', // All permissions required (AND)
  ANY = 'any', // Any permission required (OR)
}

/**
 * Access Scope
 *
 * Defines the scope of access for permissions.
 */
export enum AccessScope {
  PLATFORM = 'platform',
  SCHOOL = 'school',
  DEPARTMENT = 'department',
  OWN = 'own',
}

/**
 * Helper: Check if a role name is a platform admin role
 */
export function isPlatformAdminRole(roleName: string): boolean {
  return (
    roleName === PlatformRole.ARCHITECT ||
    roleName === PlatformRole.SUPER_ADMIN ||
    roleName === PlatformRole.PLATFORM_ADMIN
  );
}

/**
 * Helper: Check if a role name can register tenants
 */
export function canRegisterTenant(roleName: string): boolean {
  return (
    roleName === SystemRole.ARCHITECT ||
    roleName === SystemRole.SUPER_ADMIN ||
    roleName === SystemRole.OWNER
  );
}
