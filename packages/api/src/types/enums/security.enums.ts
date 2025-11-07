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
