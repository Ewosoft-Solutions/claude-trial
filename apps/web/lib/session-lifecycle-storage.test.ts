// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ACTIVITY_STORAGE_KEY,
  SESSION_POLICY_STORAGE_KEY,
  readStoredActivity,
  readStoredPolicy,
  writeStoredPolicy,
} from './session-lifecycle';

const policy = {
  idleTimeoutMinutes: 15,
  minimumIdleTimeoutMinutes: 5,
  maximumIdleTimeoutMinutes: 60,
  standardWarningSeconds: 120,
  focusWarningSeconds: 300,
};

beforeEach(() => localStorage.clear());

describe('readStoredActivity', () => {
  it('reads a positive timestamp and rejects missing / non-positive values', () => {
    expect(readStoredActivity()).toBeNull();
    localStorage.setItem(ACTIVITY_STORAGE_KEY, '1723200000000');
    expect(readStoredActivity()).toBe(1723200000000);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, '0');
    expect(readStoredActivity()).toBeNull();
    localStorage.setItem(ACTIVITY_STORAGE_KEY, 'not-a-number');
    expect(readStoredActivity()).toBeNull();
  });
});

describe('read/writeStoredPolicy', () => {
  it('round-trips the policy snapshot', () => {
    expect(readStoredPolicy()).toBeNull();
    writeStoredPolicy(policy);
    expect(readStoredPolicy()).toEqual(policy);
  });

  it('rejects a malformed snapshot (missing required numbers)', () => {
    localStorage.setItem(
      SESSION_POLICY_STORAGE_KEY,
      JSON.stringify({ idleTimeoutMinutes: 15 }),
    );
    expect(readStoredPolicy()).toBeNull();
    localStorage.setItem(SESSION_POLICY_STORAGE_KEY, 'not json');
    expect(readStoredPolicy()).toBeNull();
  });
});
