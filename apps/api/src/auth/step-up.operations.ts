/**
 * Platform-owned sensitive-operation catalog.
 *
 * Phase 3 starts with reflexive account-security operations. Keeping these
 * values server-owned prevents clients from minting challenges for arbitrary
 * operation names; the later governance phase will back this catalog with the
 * SensitiveOperationPolicy table.
 */
export const STEP_UP_OPERATION = {
  BIOMETRICS_ENROLL: 'biometrics.enroll',
  BIOMETRICS_REMOVE: 'biometrics.remove',
} as const;

export const STEP_UP_OPERATION_VALUES = Object.values(STEP_UP_OPERATION);

export type StepUpOperation =
  (typeof STEP_UP_OPERATION)[keyof typeof STEP_UP_OPERATION];

export function isStepUpOperation(value: string): value is StepUpOperation {
  return STEP_UP_OPERATION_VALUES.includes(value as StepUpOperation);
}
