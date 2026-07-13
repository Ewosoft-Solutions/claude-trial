// Centralized audit log event types to avoid string drift across services.
export const AUDIT_EVENT_TYPES = [
  'user_action',
  'data_change',
  'security_event',
  'system_event',
  'authentication',
  'authorization',
  'ai_event',
  'custom',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const DEFAULT_AUDIT_EVENT_TYPE: AuditEventType = 'user_action';

// Convenience map to avoid string drift across services.
export const AUDIT_EVENT: Record<string, AuditEventType> = {
  USER_ACTION: 'user_action',
  DATA_CHANGE: 'data_change',
  SECURITY_EVENT: 'security_event',
  SYSTEM_EVENT: 'system_event',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  AI_EVENT: 'ai_event',
  CUSTOM: 'custom',
};

// Categorized audit actions to align on naming across services.
export const AUDIT_ACTION = {
  AI_EVENT: {
    ANALYTICS: 'ai_analytics_query',
    ACADEMIC: 'ai_academic_query',
    GENERAL: 'ai_general_query',
  },
  AUTHENTICATION: {
    LOGIN: 'login',
    MFA_VERIFIED: 'mfa_verified',
  },
  AUTHORIZATION: {
    SELECT_SCHOOL: 'select_school',
  },
  SECURITY: {
    BREACH: {
      FORCE_REAUTH: 'breach_response_force_reauth',
      FORCE_PASSWORD_RESET: 'breach_response_force_password_reset',
      PLATFORM_WIDE_RESPONSE: 'platform_wide_breach_response',
      PROFILE_REVIEW: 'breach_response_profile',
    },
    JWT_SECRET: {
      ROTATED: 'jwt_secret_rotated',
      SCHEDULED_ROTATION: 'jwt_secret_scheduled_rotation',
    },
    POLICY: {
      ASSIGN_POLICY: 'assign_policy',
      CHANGE_POLICY_TIER: 'change_policy_tier',
      SET_EMERGENCY_POLICY: 'set_emergency_policy',
      REMOVE_EMERGENCY_POLICY: 'remove_emergency_policy',
    },
  },
  TENANT_LIFECYCLE: {
    TENANT_REGISTERED: 'tenant_registered',
    TENANT_UPDATED: 'tenant_updated',
    TENANT_STATUS_UPDATED: 'tenant_status_updated',
    TENANT_CONFIGURATION_UPDATED: 'tenant_configuration_updated',
  },
  USER_MANAGEMENT: {
    USER_CREATED: 'user_created',
    USER_ADDED_TO_TENANT: 'user_added_to_tenant',
    USER_UPDATED: 'user_updated',
    USER_PROFILE_UPDATED: 'user_profile_updated',
    USER_PROFILE_DELETED: 'user_profile_deleted',
    USER_INVITATION_CREATED: 'user_invitation_created',
    USER_INVITATION_ACCEPTED: 'user_invitation_accepted',
    USER_INVITATION_REVOKED: 'user_invitation_revoked',
  },
  PASSWORD_RESET: {
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  },
} as const;

export type AuditActionCategory = keyof typeof AUDIT_ACTION;

// Flat list of all audit actions to use as a typed union.
export const AUDIT_ACTION_VALUES = [
  // Authentication
  AUDIT_ACTION.AUTHENTICATION.LOGIN,
  AUDIT_ACTION.AUTHENTICATION.MFA_VERIFIED,
  // Authorization
  AUDIT_ACTION.AUTHORIZATION.SELECT_SCHOOL,
  // Security
  AUDIT_ACTION.SECURITY.BREACH.FORCE_REAUTH,
  AUDIT_ACTION.SECURITY.BREACH.FORCE_PASSWORD_RESET,
  AUDIT_ACTION.SECURITY.BREACH.PLATFORM_WIDE_RESPONSE,
  AUDIT_ACTION.SECURITY.BREACH.PROFILE_REVIEW,
  AUDIT_ACTION.SECURITY.JWT_SECRET.ROTATED,
  AUDIT_ACTION.SECURITY.JWT_SECRET.SCHEDULED_ROTATION,
  AUDIT_ACTION.SECURITY.POLICY.ASSIGN_POLICY,
  AUDIT_ACTION.SECURITY.POLICY.CHANGE_POLICY_TIER,
  AUDIT_ACTION.SECURITY.POLICY.SET_EMERGENCY_POLICY,
  AUDIT_ACTION.SECURITY.POLICY.REMOVE_EMERGENCY_POLICY,
  // Tenant lifecycle
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_REGISTERED,
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_UPDATED,
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_STATUS_UPDATED,
  AUDIT_ACTION.TENANT_LIFECYCLE.TENANT_CONFIGURATION_UPDATED,
  // User management
  AUDIT_ACTION.USER_MANAGEMENT.USER_CREATED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_ADDED_TO_TENANT,
  AUDIT_ACTION.USER_MANAGEMENT.USER_UPDATED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_PROFILE_UPDATED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_PROFILE_DELETED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_CREATED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_ACCEPTED,
  AUDIT_ACTION.USER_MANAGEMENT.USER_INVITATION_REVOKED,
  // Password reset
  AUDIT_ACTION.PASSWORD_RESET.PASSWORD_RESET_REQUESTED,
  AUDIT_ACTION.PASSWORD_RESET.PASSWORD_RESET_COMPLETED,
  // AI event
  AUDIT_ACTION.AI_EVENT.ANALYTICS,
  AUDIT_ACTION.AI_EVENT.ACADEMIC,
  AUDIT_ACTION.AI_EVENT.GENERAL,
] as const;

export type AuditAction = (typeof AUDIT_ACTION_VALUES)[number];
