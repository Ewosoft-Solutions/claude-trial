import type { AuthenticationOptionsJSON } from './webauthn';

export const STEP_UP_OPERATION = {
  SECURITY_POLICY_UPDATE: 'security-policy.update',
  BIOMETRICS_ENROLL: 'biometrics.enroll',
  BIOMETRICS_REMOVE: 'biometrics.remove',
  SYSTEM_CONFIGURATION: 'system.configuration',
  AI_SETTINGS_UPDATE: 'ai.settings.update',
  TENANT_PROVISION: 'tenant.provision',
  TENANT_SUSPEND: 'tenant.suspend',
  // WB1-6: granting / approving a scoped or time-boxed role is step-up-gated
  // (the /access grant + approve endpoints require a fresh MFA confirmation).
  USERS_ROLE_ASSIGN: 'users.role.assign',
  // Finance: creating / issuing / editing a fee invoice, and recording a
  // payment, are step-up-gated on the API (whether the tenant's policy actually
  // enforces MFA is decided server-side; the prompt no-ops when it does not).
  FINANCIAL_FEE_STRUCTURE_UPDATE: 'financial.fee-structure.update',
  FINANCIAL_TRANSACTIONS: 'financial.transactions',
} as const;

export type StepUpOperation = string;

export interface StepUpOptionsResponse {
  required: boolean;
  freshnessMinutes: number;
  hasPasskey: boolean;
  methods: {
    passkey: boolean;
    totp: boolean;
    recoveryCode: boolean;
    password: boolean;
  };
  challengeId?: string;
  options?: AuthenticationOptionsJSON;
}
