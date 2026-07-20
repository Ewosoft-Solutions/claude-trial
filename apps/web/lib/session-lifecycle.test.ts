import { describe, expect, it } from 'vitest';

import { evaluateSessionLifecycle } from './session-lifecycle';

const policy = {
  idleTimeoutMinutes: 15,
  minimumIdleTimeoutMinutes: 5,
  maximumIdleTimeoutMinutes: 60,
  standardWarningSeconds: 120,
  focusWarningSeconds: 300,
};

describe('evaluateSessionLifecycle', () => {
  it('does nothing before the inactivity threshold', () => {
    expect(
      evaluateSessionLifecycle({
        now: 14 * 60_000,
        lastActivityAt: 0,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'none' });
  });

  it('uses the standard and focus warning windows at the threshold', () => {
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000,
        lastActivityAt: 0,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'warn', focus: false, durationSeconds: 120 });
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000,
        lastActivityAt: 0,
        focusMode: true,
        policy,
      }),
    ).toEqual({ type: 'warn', focus: true, durationSeconds: 300 });
  });

  it('derives countdown time from timestamps after a suspended PWA wakes', () => {
    expect(
      evaluateSessionLifecycle({
        now: 30_000,
        lastActivityAt: 0,
        warningDeadline: 120_000,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'countdown', remainingSeconds: 90 });
    expect(
      evaluateSessionLifecycle({
        now: 121_000,
        lastActivityAt: 0,
        warningDeadline: 120_000,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'idle-logout' });
  });

  it('enforces the fixed absolute lifetime before idle decisions', () => {
    expect(
      evaluateSessionLifecycle({
        now: 10_000,
        lastActivityAt: 9_999,
        absoluteExpiresAt: 10_000,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'absolute-expiry' });
  });
});
