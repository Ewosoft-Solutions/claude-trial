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

  it('opens the countdown at the threshold with the standard and focus windows', () => {
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000,
        lastActivityAt: 0,
        focusMode: false,
        policy,
      }),
    ).toEqual({
      type: 'countdown',
      remainingSeconds: 120,
      durationSeconds: 120,
      focus: false,
    });
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000,
        lastActivityAt: 0,
        focusMode: true,
        policy,
      }),
    ).toEqual({
      type: 'countdown',
      remainingSeconds: 300,
      durationSeconds: 300,
      focus: true,
    });
  });

  it('derives the remaining countdown from timestamps, whenever it is observed', () => {
    // 30s into the 120s grace window — e.g. the first tick after a suspended
    // PWA wakes. Time already elapsed is honoured, not restarted.
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000 + 30_000,
        lastActivityAt: 0,
        focusMode: false,
        policy,
      }),
    ).toEqual({
      type: 'countdown',
      remainingSeconds: 90,
      durationSeconds: 120,
      focus: false,
    });
  });

  it('logs out immediately on return when idle + grace has already elapsed', () => {
    // Away far past idle(15m) + grace(2m); no fresh countdown on return.
    expect(
      evaluateSessionLifecycle({
        now: 60 * 60_000,
        lastActivityAt: 0,
        focusMode: false,
        policy,
      }),
    ).toEqual({ type: 'idle-logout' });
    // Exactly at the logout boundary counts as elapsed.
    expect(
      evaluateSessionLifecycle({
        now: 15 * 60_000 + 120_000,
        lastActivityAt: 0,
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
