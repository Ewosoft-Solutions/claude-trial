/**
 * Shared shape for authenticated users attached to Express requests.
 * Sourced from JWT payload and enriched by guards/middleware.
 */
export interface RequestUser {
  userId: string;
  tenantId: string;
  profileId: string;
  roleId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}
