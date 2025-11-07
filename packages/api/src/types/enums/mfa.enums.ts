/**
 * MFA Enums
 *
 * Enumerations and types for Multi-Factor Authentication operations.
 * Used for MFA methods, challenges, operations, and audit events.
 */

/**
 * MFA Method Type
 *
 * Types of MFA methods available for user authentication.
 */
export type MfaMethodType = 'sms' | 'email' | 'totp' | 'webauthn';

/**
 * MFA Challenge Type
 *
 * Types of MFA challenges that can be initiated.
 */
export type MfaChallengeType =
  | 'sms'
  | 'email'
  | 'totp'
  | 'webauthn'
  | 'recovery';

/**
 * MFA Operation Type
 *
 * Types of operations that may require MFA verification.
 */
export type MfaOperationType =
  | 'login'
  | 'sensitive_operation'
  | 'password_reset'
  | 'account_recovery'
  | 'settings_change';

/**
 * MFA Audit Event Type
 *
 * Types of MFA-related events that are logged for audit purposes.
 */
export type MfaAuditEventType =
  | 'mfa_method_setup'
  | 'mfa_method_activated'
  | 'mfa_method_disabled'
  | 'mfa_method_deleted'
  | 'mfa_verification_initiated'
  | 'mfa_verification_success'
  | 'mfa_verification_failed'
  | 'mfa_recovery_code_generated'
  | 'mfa_recovery_code_used'
  | 'mfa_primary_method_changed';
