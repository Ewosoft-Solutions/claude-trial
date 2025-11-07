/**
 * Status Enums
 *
 * Enums related to entity statuses (tenants, profiles, approvals, etc.).
 */

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
 * Pagination Sort Order
 *
 * Sort order for pagination results.
 * Used in pagination and sorting operations.
 */
export type PaginationSortOrder = 'asc' | 'desc';
