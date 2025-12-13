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
