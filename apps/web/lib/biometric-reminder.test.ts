import { describe, expect, it } from 'vitest';

import {
  BIOMETRIC_REMINDER_SNOOZE_MS,
  claimMissingPasskeyIntent,
  dismissRequiredEnrollmentPrompt,
  hasDismissedRequiredEnrollmentPrompt,
  isBiometricReminderFocusRoute,
  readBiometricReminderPreference,
  recordMissingPasskeyIntent,
  shouldShowBiometricReminder,
  snoozeBiometricReminder,
  suppressBiometricReminder,
} from './biometric-reminder';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('biometric reminder intent', () => {
  it('claims a recent missing-passkey attempt for the authenticated account', () => {
    const storage = memoryStorage();
    recordMissingPasskeyIntent(1_000, storage);

    expect(claimMissingPasskeyIntent('user-1', 2_000, storage)).toBe(true);
    expect(
      claimMissingPasskeyIntent('user-1', 2 * 60 * 60 * 1000, storage),
    ).toBe(true);
    expect(claimMissingPasskeyIntent('user-2', 2_500, storage)).toBe(false);
  });

  it('drops stale anonymous intent instead of prompting a later login', () => {
    const storage = memoryStorage();
    recordMissingPasskeyIntent(1_000, storage);

    expect(
      claimMissingPasskeyIntent('user-1', 2 * 60 * 60 * 1000, storage),
    ).toBe(false);
  });
});

describe('biometric reminder preferences', () => {
  it('keeps the snooze due date so the reminder can return later', () => {
    const storage = memoryStorage();
    snoozeBiometricReminder('user-1', 1_000, storage);

    expect(readBiometricReminderPreference('user-1', storage)).toEqual({
      mode: 'snoozed',
      until: 1_000 + BIOMETRIC_REMINDER_SNOOZE_MS,
    });
    expect(readBiometricReminderPreference('user-1', storage)).toEqual({
      mode: 'snoozed',
      until: 1_000 + BIOMETRIC_REMINDER_SNOOZE_MS,
    });
  });

  it('stores a per-account permanent suppression in this app', () => {
    const storage = memoryStorage();
    suppressBiometricReminder('user-1', storage);

    expect(readBiometricReminderPreference('user-1', storage)).toEqual({
      mode: 'never',
    });
    expect(readBiometricReminderPreference('user-2', storage)).toBeNull();
  });

  it('dismisses a required modal for this app session only', () => {
    const storage = memoryStorage();

    expect(hasDismissedRequiredEnrollmentPrompt('user-1', storage)).toBe(false);
    dismissRequiredEnrollmentPrompt('user-1', storage);
    expect(hasDismissedRequiredEnrollmentPrompt('user-1', storage)).toBe(true);
    expect(hasDismissedRequiredEnrollmentPrompt('user-2', storage)).toBe(false);
  });
});

describe('biometric reminder visibility', () => {
  it('shows optional enrollment only after intent and without suppression', () => {
    expect(
      shouldShowBiometricReminder({
        enrolled: false,
        policy: 'allow',
        hasIntent: true,
        preference: null,
        focusRoute: false,
      }),
    ).toBe(true);
    expect(
      shouldShowBiometricReminder({
        enrolled: false,
        policy: 'allow',
        hasIntent: true,
        preference: { mode: 'never' },
        focusRoute: false,
      }),
    ).toBe(false);
  });

  it('always restores a required reminder on a safe route', () => {
    expect(
      shouldShowBiometricReminder({
        enrolled: false,
        policy: 'require',
        hasIntent: false,
        preference: { mode: 'never' },
        focusRoute: false,
      }),
    ).toBe(true);
  });

  it('restores an optional reminder when its snooze becomes due', () => {
    expect(
      shouldShowBiometricReminder({
        enrolled: false,
        policy: 'allow',
        hasIntent: false,
        preference: { mode: 'snoozed', until: 1_000 },
        focusRoute: false,
        now: 1_001,
      }),
    ).toBe(true);
  });

  it('queues every reminder during focused work', () => {
    expect(isBiometricReminderFocusRoute('/classes/assessments/take/a-1')).toBe(
      true,
    );
    expect(isBiometricReminderFocusRoute('/classes/assessments/take')).toBe(
      false,
    );
    expect(
      shouldShowBiometricReminder({
        enrolled: false,
        policy: 'require',
        hasIntent: true,
        preference: null,
        focusRoute: true,
      }),
    ).toBe(false);
  });
});
