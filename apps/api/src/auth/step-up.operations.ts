import {
  SENSITIVE_OPERATION_NAMES,
  type SensitiveOperationName,
} from '@workspace/database';

/** Route-safe names from the versioned platform catalog. */
export const STEP_UP_OPERATION = {
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  ROLES_CUSTOM_LEVEL7_CREATE: 'roles.custom.level7.create',
  PERMISSIONS_MODIFY: 'permissions.modify',
  USERS_ROLE_ASSIGN: 'users.role.assign',
  USERS_CREATE: 'users.create',
  SECURITY_POLICY_UPDATE: 'security-policy.update',
  FINANCIAL_TRANSACTIONS: 'financial.transactions',
  FINANCIAL_FEE_STRUCTURE_UPDATE: 'financial.fee-structure.update',
  FINANCIAL_PAYOUT: 'financial.payout',
  ACCOUNT_PASSWORD_CHANGE: 'account.password.change',
  ACCOUNT_EMAIL_CHANGE: 'account.email.change',
  MFA_METHOD_ADD: 'mfa.method.add',
  MFA_METHOD_REMOVE: 'mfa.method.remove',
  MFA_RECOVERY_GENERATE: 'mfa.recovery.generate',
  BIOMETRICS_ENROLL: 'biometrics.enroll',
  BIOMETRICS_REMOVE: 'biometrics.remove',
  USERS_FORCE_LOGOUT: 'users.force-logout',
  USERS_PASSWORD_RESET: 'users.password.reset',
  STUDENTS_DELETE: 'students.delete',
  USERS_DELETE: 'users.delete',
  GRADES_OVERRIDE: 'grades.override',
  DATA_BULK_IMPORT: 'data.bulk-import',
  DATA_BULK_DELETE: 'data.bulk-delete',
  DATA_EXPORT: 'data.export',
  BACKUP_RESTORE: 'backup.restore',
  SYSTEM_CONFIGURATION: 'system.configuration',
  AI_SETTINGS_UPDATE: 'ai.settings.update',
  BREACH_RESPONSE: 'breach.response',
  TENANT_PROVISION: 'tenant.provision',
  TENANT_SUSPEND: 'tenant.suspend',
} as const satisfies Record<string, SensitiveOperationName>;

export const STEP_UP_OPERATION_VALUES = SENSITIVE_OPERATION_NAMES;
export type StepUpOperation = SensitiveOperationName;

export function isStepUpOperation(value: string): value is StepUpOperation {
  return STEP_UP_OPERATION_VALUES.includes(value as StepUpOperation);
}
