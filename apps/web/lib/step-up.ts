import type { AuthenticationOptionsJSON } from './webauthn';

/**
 * Client mirror of the API-owned operation catalog. The API still validates
 * every value; this keeps call sites typed and prevents accidental drift.
 */
export const STEP_UP_OPERATION = {
  BIOMETRICS_ENROLL: 'biometrics.enroll',
  BIOMETRICS_REMOVE: 'biometrics.remove',
} as const;

export type StepUpOperation =
  (typeof STEP_UP_OPERATION)[keyof typeof STEP_UP_OPERATION];

export type StepUpOptionsResponse =
  | { hasPasskey: false }
  | {
      hasPasskey: true;
      challengeId: string;
      options: AuthenticationOptionsJSON;
    };
