import type { AuthenticationOptionsJSON } from './webauthn';

export const STEP_UP_OPERATION = {
  SECURITY_POLICY_UPDATE: 'security-policy.update',
  BIOMETRICS_ENROLL: 'biometrics.enroll',
  BIOMETRICS_REMOVE: 'biometrics.remove',
  SYSTEM_CONFIGURATION: 'system.configuration',
  AI_SETTINGS_UPDATE: 'ai.settings.update',
  TENANT_PROVISION: 'tenant.provision',
  TENANT_SUSPEND: 'tenant.suspend',
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
