/**
 * Security Enums
 *
 * Enums related to security policies, breach response, and enforcement.
 */

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
 * Breach Severity Levels
 *
 * Severity levels for security breach responses.
 * Used to determine the appropriate response action.
 */
export enum BreachSeverity {
  LOW = 'low', // Suspicious activity - MFA re-auth only
  MEDIUM = 'medium', // Potential compromise - MFA re-auth + enhanced monitoring
  HIGH = 'high', // Likely compromise - MFA re-auth + password reset
  CRITICAL = 'critical', // Confirmed breach - Password reset + MFA + account review
}

/**
 * Policy Tier
 *
 * Security policy tier levels for schools.
 * Defines the security level applied to a school.
 */
export type PolicyTier = 'basic' | 'enhanced' | 'maximum';

/**
 * Device Management
 *
 * Device management enforcement levels.
 * Controls how strictly device access is managed.
 */
export type DeviceManagement = 'none' | 'basic' | 'strict';

/**
 * Audit Level
 *
 * Audit logging levels for security policies.
 * Determines the depth of audit logging.
 */
export type AuditLevel = 'basic' | 'standard' | 'comprehensive';

/**
 * JWT Secret Rotation Reason
 *
 * Reasons for rotating JWT secrets.
 * Used for audit logging and rotation tracking.
 */
export type JWTSecretRotationReason =
  | 'scheduled'
  | 'emergency'
  | 'breach_response'
  | 'manual';

/**
 * JWT Token Type
 *
 * Types of JWT tokens in the system.
 * - access: Full tenant-scoped access token (issued after school selection)
 * - refresh: Long-lived refresh token (issued after school selection)
 * - pre_auth: Short-lived token issued after login, valid only for school selection
 */
export type JWTTokenType = 'access' | 'refresh' | 'pre_auth';
