import type { SessionLifecyclePolicy } from './session';

export const ACTIVITY_STORAGE_KEY = 'swe:session-activity:v1';

export type LifecycleDecision =
  | { type: 'none' }
  | { type: 'absolute-expiry' }
  | { type: 'idle-logout' }
  | { type: 'countdown'; remainingSeconds: number }
  | { type: 'warn'; durationSeconds: number; focus: boolean };

export function evaluateSessionLifecycle(input: {
  now: number;
  lastActivityAt: number;
  absoluteExpiresAt?: number;
  warningDeadline?: number;
  focusMode: boolean;
  policy: SessionLifecyclePolicy;
}): LifecycleDecision {
  if (input.absoluteExpiresAt && input.now >= input.absoluteExpiresAt) {
    return { type: 'absolute-expiry' };
  }
  if (input.warningDeadline) {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((input.warningDeadline - input.now) / 1000),
    );
    return remainingSeconds === 0
      ? { type: 'idle-logout' }
      : { type: 'countdown', remainingSeconds };
  }
  const idleMilliseconds = input.policy.idleTimeoutMinutes * 60 * 1000;
  if (input.now - input.lastActivityAt < idleMilliseconds) {
    return { type: 'none' };
  }
  return {
    type: 'warn',
    focus: input.focusMode,
    durationSeconds: input.focusMode
      ? input.policy.focusWarningSeconds
      : input.policy.standardWarningSeconds,
  };
}
