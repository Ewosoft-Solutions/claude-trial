/**
 * Tenant Context Types
 *
 * Types for tenant resolution and context management in the multi-tenant system.
 * These types are used throughout the backend to identify and validate tenant context.
 */

/**
 * Tenant Context - Complete tenant and user context for a request
 *
 * This context is attached to requests after tenant resolution middleware
 * and contains all information needed for tenant-aware operations.
 */
export interface TenantContext {
  /** UUID of the tenant (school) */
  tenantId: string;

  /** Optional tenant slug (for URLs, subdomain resolution) */
  tenantSlug?: string;

  /** UUID of the user making the request */
  userId: string;

  /** UUID of the UserTenant profile (user's profile at this tenant) */
  profileId: string;

  /** User's roles in this tenant */
  roles: string[];

  /** User's permissions for this profile */
  permissions: Permission[];

  /** Tenant status */
  tenantStatus: 'active' | 'pending' | 'suspended';

  /** Profile status */
  profileStatus: 'active' | 'inactive' | 'pending' | 'suspended';
}

/**
 * Permission - Granular permission definition
 *
 * Matches the Permission model from the database schema.
 */
export interface Permission {
  /** Permission identifier (e.g., 'students.view', 'grades.edit') */
  name: string;

  /** Human-readable display name */
  label: string;

  /** Detailed description */
  description?: string;

  /** Resource type (e.g., 'students', 'grades', 'platform') */
  resource: string;

  /** Action type (e.g., 'view', 'edit', 'create', 'delete') */
  action: string;

  /** Optional context (e.g., 'own_classes', 'children') */
  context?: string;

  /** Permission category */
  category: string;
}

/**
 * Public Tenant Context - Minimal tenant context for public endpoints
 *
 * Used when tenant needs to be identified but user is not authenticated.
 */
export interface PublicTenantContext {
  /** UUID of the tenant */
  tenantId: string;

  /** Optional tenant slug */
  tenantSlug?: string;

  /** Tenant status */
  tenantStatus: 'active' | 'pending' | 'suspended';
}

/**
 * Tenant Resolution Result - Result of tenant resolution process
 */
export interface TenantResolutionResult {
  /** Successfully resolved tenant context */
  context: TenantContext | PublicTenantContext;

  /** Whether resolution was successful */
  success: boolean;

  /** Error message if resolution failed */
  error?: string;

  /** Error code for error handling */
  errorCode?: string;
}
