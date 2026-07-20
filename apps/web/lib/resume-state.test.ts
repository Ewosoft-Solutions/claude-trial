import { describe, expect, it } from 'vitest';

import {
  createResumeState,
  sanitizeResumePath,
  signResumeState,
  verifyResumeState,
} from './resume-state';
import { resolveResumeTarget } from './resume-routes';

describe('signed resume state', () => {
  it('removes sensitive redirect and token query values', () => {
    expect(
      sanitizeResumePath(
        '/classes/assessments/take/a1?question=4&token=secret&from=%2Fevil',
      ),
    ).toBe('/classes/assessments/take/a1?question=4');
  });

  it('round-trips a valid state and rejects tampering or expiry', async () => {
    const state = createResumeState(
      {
        path: '/classes/assessments/take/a1',
        tenantId: 'tenant-1',
        profileId: 'profile-1',
        modalKey: 'global-search',
      },
      1_000,
    );
    expect(state).not.toBeNull();
    const token = await signResumeState(state!);
    expect(await verifyResumeState(token!, 2_000)).toEqual(state);
    expect(await verifyResumeState(`${token}tampered`, 2_000)).toBeNull();
    expect(await verifyResumeState(token!, state!.expiresAt + 1)).toBeNull();
  });
});

describe('resolveResumeTarget', () => {
  const state = createResumeState(
    {
      path: '/classes/assessments/take/a1',
      tenantId: 'tenant-1',
      profileId: 'profile-1',
    },
    Date.now(),
  )!;

  it('restores an assessment only with the permission and matching context', () => {
    expect(
      resolveResumeTarget(state, {
        permissions: ['assessments.take'],
        scope: 'school',
        defaultSchoolId: 'tenant-1',
        activeProfileId: 'profile-1',
      }),
    ).toEqual({
      target: '/classes/assessments/take/a1',
      restored: true,
    });
  });

  it('falls back when permission or tenant context changed', () => {
    expect(
      resolveResumeTarget(state, {
        permissions: [],
        scope: 'school',
        defaultSchoolId: 'tenant-1',
        activeProfileId: 'profile-1',
      }).target,
    ).toBe('/overview');
    expect(
      resolveResumeTarget(state, {
        permissions: ['assessments.take'],
        scope: 'school',
        defaultSchoolId: 'tenant-2',
        activeProfileId: 'profile-1',
      }).target,
    ).toBe('/overview');
  });
});
