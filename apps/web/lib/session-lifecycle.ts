import type { SessionLifecyclePolicy } from './session';

export const ACTIVITY_STORAGE_KEY = 'swe:session-activity:v1';
/** Snapshot of the effective lifecycle policy, persisted so pre-auth surfaces
 *  (the resume trampoline) can make the idle decision without a live session. */
export const SESSION_POLICY_STORAGE_KEY = 'swe:session-policy:v1';

/** Last user-activity timestamp, or null when unset/unreadable. Shared so the
 *  resume trampoline evaluates the idle deadline the same way the provider does. */
export function readStoredActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the effective policy (survives app restarts) so the resume screen
 *  can judge idle-expiry before it re-authenticates the user into the app. */
export function writeStoredPolicy(policy: SessionLifecyclePolicy): void {
  try {
    localStorage.setItem(SESSION_POLICY_STORAGE_KEY, JSON.stringify(policy));
  } catch {
    // Storage may be disabled (Safari private mode / restricted webviews).
  }
}

/** Read the persisted policy snapshot, or null when absent/malformed. */
export function readStoredPolicy(): SessionLifecyclePolicy | null {
  try {
    const raw = localStorage.getItem(SESSION_POLICY_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SessionLifecyclePolicy>;
    if (
      typeof value.idleTimeoutMinutes === 'number' &&
      typeof value.standardWarningSeconds === 'number' &&
      typeof value.focusWarningSeconds === 'number'
    ) {
      return value as SessionLifecyclePolicy;
    }
    return null;
  } catch {
    return null;
  }
}

export type LifecycleDecision =
  | { type: 'none' }
  | { type: 'absolute-expiry' }
  | { type: 'idle-logout' }
  | {
      type: 'countdown';
      remainingSeconds: number;
      durationSeconds: number;
      focus: boolean;
    };

/**
 * Pure, timestamp-driven verdict on where a session stands *right now*.
 *
 * The whole grace window is anchored to `lastActivityAt`, never to the moment
 * this happens to run. That matters because the caller's 1s interval is
 * throttled or frozen while the tab is backgrounded (and suspended entirely on
 * mobile / installed PWAs): a live countdown simply cannot tick in the
 * background. So correctness lives here instead — when the tab wakes and this
 * re-evaluates, a user who has been away past `idle + grace` is logged out on
 * the spot, and one who returns mid-grace sees the *true* time remaining rather
 * than a fresh full window restarting from their return.
 */
export function evaluateSessionLifecycle(input: {
  now: number;
  lastActivityAt: number;
  absoluteExpiresAt?: number;
  focusMode: boolean;
  policy: SessionLifecyclePolicy;
}): LifecycleDecision {
  if (input.absoluteExpiresAt && input.now >= input.absoluteExpiresAt) {
    return { type: 'absolute-expiry' };
  }
  const durationSeconds = input.focusMode
    ? input.policy.focusWarningSeconds
    : input.policy.standardWarningSeconds;
  const warnStartsAt =
    input.lastActivityAt + input.policy.idleTimeoutMinutes * 60 * 1000;
  const logoutAt = warnStartsAt + durationSeconds * 1000;

  if (input.now >= logoutAt) {
    return { type: 'idle-logout' };
  }
  if (input.now >= warnStartsAt) {
    return {
      type: 'countdown',
      remainingSeconds: Math.max(1, Math.ceil((logoutAt - input.now) / 1000)),
      durationSeconds,
      focus: input.focusMode,
    };
  }
  return { type: 'none' };
}
