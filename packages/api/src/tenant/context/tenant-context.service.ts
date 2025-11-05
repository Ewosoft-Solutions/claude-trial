/**
 * Tenant Context Service
 *
 * Service for managing tenant context, school selection, and profile switching.
 * Provides utilities for context management throughout the application.
 */

import {
  TenantContext,
  PublicTenantContext,
} from '../../types/tenant-context.types';

/**
 * Tenant Context Service
 *
 * Manages tenant context for requests, including:
 * - School selection
 * - Profile switching
 * - Context validation
 * - Context storage and retrieval
 */
export class TenantContextService {
  /**
   * Get tenant context from request
   *
   * Extracts tenant context that should have been attached by middleware.
   */
  static getFromRequest(req: any): TenantContext | PublicTenantContext | null {
    return req.tenantContext || null;
  }

  /**
   * Set tenant context on request
   *
   * Attaches tenant context to request object for use in downstream handlers.
   */
  static setOnRequest(
    req: any,
    context: TenantContext | PublicTenantContext,
  ): void {
    req.tenantContext = context;
  }

  /**
   * Check if context is authenticated
   *
   * Returns true if context includes user information (authenticated request).
   */
  static isAuthenticated(
    context: TenantContext | PublicTenantContext | null,
  ): context is TenantContext {
    return context !== null && 'userId' in context;
  }

  /**
   * Validate tenant context
   *
   * Validates that tenant context is valid and active.
   */
  static validateContext(context: TenantContext | PublicTenantContext | null): {
    valid: boolean;
    error?: string;
  } {
    if (!context) {
      return { valid: false, error: 'Tenant context not found' };
    }

    // Check tenant status
    if (context.tenantStatus !== 'active') {
      return {
        valid: false,
        error: `Tenant is ${context.tenantStatus}`,
      };
    }

    // For authenticated contexts, check profile status
    if (this.isAuthenticated(context)) {
      if (context.profileStatus !== 'active') {
        return {
          valid: false,
          error: `Profile is ${context.profileStatus}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get tenant ID from context
   */
  static getTenantId(
    context: TenantContext | PublicTenantContext | null,
  ): string | null {
    return context?.tenantId || null;
  }

  /**
   * Get profile ID from context (authenticated only)
   */
  static getProfileId(
    context: TenantContext | PublicTenantContext | null,
  ): string | null {
    if (this.isAuthenticated(context)) {
      return context.profileId;
    }
    return null;
  }

  /**
   * Get user ID from context (authenticated only)
   */
  static getUserId(
    context: TenantContext | PublicTenantContext | null,
  ): string | null {
    if (this.isAuthenticated(context)) {
      return context.userId;
    }
    return null;
  }
}
