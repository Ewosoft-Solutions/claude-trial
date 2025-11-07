/**
 * Shared Enums and Constants
 *
 * Centralized enums and constants used across the application.
 * This provides type safety, consistency, and a single source of truth.
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
 * Tenant Status
 *
 * Status of a tenant (school) in the system.
 */
export enum TenantStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

/**
 * Profile Status
 *
 * Status of a user's profile within a tenant.
 */
export enum ProfileStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
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
 * Enforced By
 *
 * Indicates who enforced a security policy or rule.
 */
export enum EnforcedBy {
  SCHOOL_ADMIN = 'school_admin',
  PLATFORM_ADMIN = 'platform_admin',
}

/**
 * Approval Level
 */
export enum ApprovalLevel {
  SCHOOL = 'school', // School-level approval
  PLATFORM = 'platform', // Platform-level approval
  EMERGENCY = 'emergency', // Emergency override (no approval needed)
}

/**
 * Maker-Checker Status
 *
 * Status of maker-checker approval requests.
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

/**
 * Helper: Check if a role name is a platform admin role
 */
export function isPlatformAdminRole(roleName: string): boolean {
  return (
    roleName === PlatformRole.ARCHITECT ||
    roleName === PlatformRole.SUPER_ADMIN ||
    roleName === PlatformRole.PLATFORM_ADMIN ||
    roleName === 'platform_admin' // Legacy support
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
