const MISSING_PASSKEY_INTENT_KEY = 'swe:biometric-enrollment-intent:v1';
const ACTIVE_REMINDER_PREFIX = 'swe:biometric-enrollment-active:v1:';
const REMINDER_PREFERENCE_PREFIX = 'swe:biometric-enrollment-preference:v1:';
const REQUIRED_PROMPT_DISMISSED_PREFIX =
  'swe:biometric-enrollment-required-dismissed:v1:';

export const BIOMETRIC_REMINDER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const INTENT_TTL_MS = 60 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BiometricReminderPreference =
  | { mode: 'snoozed'; until: number }
  | { mode: 'never' };

function sessionStore(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function localStore(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function activeReminderKey(accountId: string): string {
  return `${ACTIVE_REMINDER_PREFIX}${accountId}`;
}

function preferenceKey(accountId: string): string {
  return `${REMINDER_PREFERENCE_PREFIX}${accountId}`;
}

function readTimestamp(storage: StorageLike, key: string): number | null {
  try {
    const value = Number(storage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Remember that the returning user explicitly tried passkey sign-in. */
export function recordMissingPasskeyIntent(
  now = Date.now(),
  storage = sessionStore(),
): void {
  if (!storage) return;
  try {
    storage.setItem(MISSING_PASSKEY_INTENT_KEY, String(now));
  } catch {
    // Storage can be unavailable in private browsing; sign-in still works.
  }
}

export function clearMissingPasskeyIntent(storage = sessionStore()): void {
  if (!storage) return;
  try {
    storage.removeItem(MISSING_PASSKEY_INTENT_KEY);
  } catch {
    // Best effort only.
  }
}

/**
 * Move the anonymous login intent onto the authenticated account. The active
 * marker survives client-side navigation and page reloads for this app session.
 */
export function claimMissingPasskeyIntent(
  accountId: string,
  now = Date.now(),
  storage = sessionStore(),
): boolean {
  if (!storage || !accountId) return false;
  const activeKey = activeReminderKey(accountId);
  const activeAt = readTimestamp(storage, activeKey);
  if (activeAt) return true;

  const attemptedAt = readTimestamp(storage, MISSING_PASSKEY_INTENT_KEY);
  try {
    storage.removeItem(MISSING_PASSKEY_INTENT_KEY);
    storage.removeItem(activeKey);
    if (!attemptedAt || now - attemptedAt > INTENT_TTL_MS) return false;
    storage.setItem(activeKey, String(attemptedAt));
    return true;
  } catch {
    return false;
  }
}

export function clearBiometricReminderIntent(
  accountId: string,
  storage = sessionStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.removeItem(activeReminderKey(accountId));
    storage.removeItem(MISSING_PASSKEY_INTENT_KEY);
  } catch {
    // Best effort only.
  }
}

export function readBiometricReminderPreference(
  accountId: string,
  storage = localStore(),
): BiometricReminderPreference | null {
  if (!storage || !accountId) return null;
  const key = preferenceKey(accountId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BiometricReminderPreference>;
    if (value.mode === 'never') return { mode: 'never' };
    if (
      value.mode === 'snoozed' &&
      typeof value.until === 'number' &&
      Number.isFinite(value.until) &&
      value.until > 0
    ) {
      return { mode: 'snoozed', until: value.until };
    }
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Best effort only.
    }
  }
  return null;
}

export function snoozeBiometricReminder(
  accountId: string,
  now = Date.now(),
  storage = localStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.setItem(
      preferenceKey(accountId),
      JSON.stringify({
        mode: 'snoozed',
        until: now + BIOMETRIC_REMINDER_SNOOZE_MS,
      } satisfies BiometricReminderPreference),
    );
  } catch {
    // Best effort only.
  }
}

export function suppressBiometricReminder(
  accountId: string,
  storage = localStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.setItem(
      preferenceKey(accountId),
      JSON.stringify({ mode: 'never' } satisfies BiometricReminderPreference),
    );
  } catch {
    // Best effort only.
  }
}

export function clearBiometricReminderPreference(
  accountId: string,
  storage = localStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.removeItem(preferenceKey(accountId));
  } catch {
    // Best effort only.
  }
}

export function hasDismissedRequiredEnrollmentPrompt(
  accountId: string,
  storage = sessionStore(),
): boolean {
  if (!storage || !accountId) return false;
  try {
    return (
      storage.getItem(`${REQUIRED_PROMPT_DISMISSED_PREFIX}${accountId}`) === '1'
    );
  } catch {
    return false;
  }
}

export function dismissRequiredEnrollmentPrompt(
  accountId: string,
  storage = sessionStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.setItem(`${REQUIRED_PROMPT_DISMISSED_PREFIX}${accountId}`, '1');
  } catch {
    // Best effort only.
  }
}

export function clearRequiredEnrollmentPromptDismissal(
  accountId: string,
  storage = sessionStore(),
): void {
  if (!storage || !accountId) return;
  try {
    storage.removeItem(`${REQUIRED_PROMPT_DISMISSED_PREFIX}${accountId}`);
  } catch {
    // Best effort only.
  }
}

export function shouldShowBiometricReminder({
  enrolled,
  policy,
  hasIntent,
  preference,
  focusRoute,
  now = Date.now(),
}: {
  enrolled: boolean;
  policy: 'require' | 'allow' | 'forbid';
  hasIntent: boolean;
  preference: BiometricReminderPreference | null;
  focusRoute: boolean;
  now?: number;
}): boolean {
  if (enrolled || policy === 'forbid' || focusRoute) return false;
  if (policy === 'require') return true;
  if (preference?.mode === 'never') return false;
  if (preference?.mode === 'snoozed') return preference.until <= now;
  return hasIntent;
}

/** Avoid interrupting focused work; the reminder returns on the next safe page. */
export function isBiometricReminderFocusRoute(pathname: string): boolean {
  return (
    /^\/classes\/assessments\/take\/[^/]+(?:\/|$)/.test(pathname) ||
    /\/(?:assignments|reading|watch|videos)(?:\/|$)/.test(pathname)
  );
}
