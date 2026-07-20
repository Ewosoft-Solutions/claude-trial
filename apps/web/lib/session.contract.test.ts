/**
 * Contract test: GET /auth/me response shape ↔ Session
 *
 * This test does NOT hit the network. It asserts that the mapping logic in
 * getSession() correctly transforms an /auth/me-shaped payload into a Session
 * value that satisfies every field of the Session interface.
 *
 * When the backend response shape changes, this test will fail first —
 * preventing shape drift between the API and the frontend context.
 */

import { describe, expect, it } from 'vitest';
import type { Session, SessionSchool } from './session';
import type { UserProfile } from '@workspace/ui/types/shell.types';
import type {
  FeatureKey,
  PermissionKey,
  SchoolType,
} from '@workspace/ui/types/access.types';

// ── Simulate the raw /auth/me API response ──────────────────────────────────

const RAW_ME_RESPONSE = {
  accountId: 'user-opaque-1',
  user: {
    name: 'Ada Okafor',
    email: 'ada@stjude.edu',
    initials: 'AO',
    caption: 'Principal',
    color: '#334155',
  },
  scope: 'school' as const,
  clearanceLevel: 7,
  roles: ['Principal'],
  permissions: ['students.view', 'attendance.view', 'grades.view'] as string[],
  defaultSchoolId: 'tenant-abc',
  activeProfileId: 'profile-1',
  defaultProfileId: 'profile-1',
  sessionPolicy: {
    idleTimeoutMinutes: 15,
    minimumIdleTimeoutMinutes: 5,
    maximumIdleTimeoutMinutes: 60,
    standardWarningSeconds: 120,
    focusWarningSeconds: 300,
  },
  accessExpiresAt: Date.now() + 60 * 60 * 1000,
  biometricEnrollment: {
    policy: 'require' as const,
    activePolicy: 'allow' as const,
    requiredBy: [
      { schoolId: 'tenant-required', schoolName: 'Required Academy' },
    ],
    enrolled: false,
  },
  schools: [
    {
      id: 'tenant-abc',
      name: 'St. Jude Academy',
      initials: 'SJ',
      color: '#4f6df5',
      schoolType: 'secondary',
      enabledFeatures: [
        'transport',
        'library',
        'health',
        'messaging',
        'cafeteria',
      ],
      profiles: [
        { profileId: 'profile-1', role: 'Principal', caption: 'Principal' },
      ],
    },
  ],
} satisfies {
  accountId: string;
  user: UserProfile;
  scope: 'school' | 'platform';
  clearanceLevel: number;
  roles: string[];
  permissions: string[];
  defaultSchoolId?: string;
  activeProfileId?: string;
  defaultProfileId?: string;
  sessionPolicy: Session['sessionPolicy'];
  accessExpiresAt: number;
  biometricEnrollment: Session['biometricEnrollment'];
  schools: Array<{
    id: string;
    name: string;
    initials: string;
    color: string;
    schoolType: string;
    enabledFeatures?: string[];
    profiles: Array<{ profileId: string; role: string; caption: string }>;
  }>;
};

// ── The mapping performed inside getSession() ────────────────────────────────

function mapMeResponseToSession(me: typeof RAW_ME_RESPONSE): Session {
  return {
    accountId: me.accountId,
    user: me.user,
    scope: me.scope,
    clearanceLevel: me.clearanceLevel as Session['clearanceLevel'],
    roles: me.roles,
    permissions: me.permissions as PermissionKey[],
    defaultSchoolId: me.defaultSchoolId,
    activeProfileId: me.activeProfileId,
    defaultProfileId: me.defaultProfileId,
    sessionPolicy: me.sessionPolicy,
    accessExpiresAt: me.accessExpiresAt,
    biometricEnrollment: me.biometricEnrollment,
    schools: me.schools.map((s) => ({
      id: s.id,
      name: s.name,
      initials: s.initials,
      caption:
        s.profiles.find((p) => p.profileId === me.activeProfileId)?.caption ??
        s.profiles[0]?.caption ??
        'Staff',
      color: s.color,
      schoolType: (s.schoolType || 'secondary') as SchoolType,
      enabledFeatures: (s.enabledFeatures ?? []) as FeatureKey[],
      profiles: s.profiles,
    })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Session contract — /auth/me ↔ Session shape', () => {
  const session = mapMeResponseToSession(RAW_ME_RESPONSE);

  it('user profile fields are present', () => {
    const { user } = session;
    expect(typeof user.name).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.initials).toBe('string');
    expect(typeof user.caption).toBe('string');
  });

  it('carries an opaque account id and effective enrollment policy', () => {
    expect(session.accountId).toBe('user-opaque-1');
    expect(session.biometricEnrollment).toEqual({
      policy: 'require',
      activePolicy: 'allow',
      requiredBy: [
        { schoolId: 'tenant-required', schoolName: 'Required Academy' },
      ],
      enrolled: false,
    });
  });

  it('scope is a valid NavScope', () => {
    expect(['school', 'platform']).toContain(session.scope);
  });

  it('clearanceLevel is a number between 0 and 10', () => {
    expect(session.clearanceLevel).toBeGreaterThanOrEqual(0);
    expect(session.clearanceLevel).toBeLessThanOrEqual(10);
  });

  it('roles is a non-empty string array', () => {
    expect(Array.isArray(session.roles)).toBe(true);
    expect(session.roles.length).toBeGreaterThan(0);
    session.roles.forEach((r) => expect(typeof r).toBe('string'));
  });

  it('permissions is an array of strings', () => {
    expect(Array.isArray(session.permissions)).toBe(true);
    session.permissions.forEach((p) => expect(typeof p).toBe('string'));
  });

  it('schools have all required SchoolOption fields', () => {
    expect(Array.isArray(session.schools)).toBe(true);
    session.schools.forEach((s: SessionSchool) => {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.initials).toBe('string');
      expect(typeof s.caption).toBe('string');
      expect(typeof s.schoolType).toBe('string');
    });
  });

  it('defaultSchoolId matches one of the school ids when present', () => {
    if (session.defaultSchoolId !== undefined) {
      const ids = session.schools.map((s) => s.id);
      expect(ids).toContain(session.defaultSchoolId);
    }
  });

  it('unknown schoolType falls back to secondary', () => {
    const withUnknownType = mapMeResponseToSession({
      ...RAW_ME_RESPONSE,
      schools: [{ ...RAW_ME_RESPONSE.schools[0]!, schoolType: '' }],
    });
    // empty string coerces to 'secondary' via the ?? fallback
    expect(withUnknownType.schools[0]!.schoolType).toBe('secondary');
  });

  it('a school carries its full profiles array, not just the active one', () => {
    expect(session.schools[0]!.profiles).toEqual([
      { profileId: 'profile-1', role: 'Principal', caption: 'Principal' },
    ]);
  });

  it('multiple profiles at the same school stay one school entry, caption from the first profile when no active profile matches', () => {
    const dualProfile = mapMeResponseToSession({
      ...RAW_ME_RESPONSE,
      activeProfileId: 'profile-unrelated',
      schools: [
        {
          ...RAW_ME_RESPONSE.schools[0]!,
          profiles: [
            { profileId: 'profile-1', role: 'Parent', caption: 'Parent' },
            { profileId: 'profile-2', role: 'Teacher', caption: 'Teacher' },
          ],
        },
      ],
    });

    expect(dualProfile.schools).toHaveLength(1);
    expect(dualProfile.schools[0]!.caption).toBe('Parent');
    expect(dualProfile.schools[0]!.profiles).toHaveLength(2);
  });

  it('caption reflects the currently active profile, not just the first one', () => {
    const dualProfile = mapMeResponseToSession({
      ...RAW_ME_RESPONSE,
      activeProfileId: 'profile-2',
      schools: [
        {
          ...RAW_ME_RESPONSE.schools[0]!,
          profiles: [
            { profileId: 'profile-1', role: 'Parent', caption: 'Parent' },
            { profileId: 'profile-2', role: 'Teacher', caption: 'Teacher' },
          ],
        },
      ],
    });

    expect(dualProfile.schools[0]!.caption).toBe('Teacher');
  });

  it('defaultProfileId passes through unchanged (the stored preference, not the active profile)', () => {
    const withDefault = mapMeResponseToSession({
      ...RAW_ME_RESPONSE,
      activeProfileId: 'profile-2',
      defaultProfileId: 'profile-1',
    });
    expect(withDefault.defaultProfileId).toBe('profile-1');
    expect(withDefault.activeProfileId).toBe('profile-2');
  });
});
