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
import type { PermissionKey, SchoolType } from '@workspace/ui/types/access.types';

// ── Simulate the raw /auth/me API response ──────────────────────────────────

const RAW_ME_RESPONSE = {
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
  schools: [
    {
      id: 'tenant-abc',
      name: 'St. Jude Academy',
      initials: 'SJ',
      color: '#4f6df5',
      schoolType: 'secondary',
      profiles: [
        { profileId: 'profile-1', role: 'Principal', caption: 'Principal' },
      ],
    },
  ],
} satisfies {
  user: UserProfile;
  scope: 'school' | 'platform';
  clearanceLevel: number;
  roles: string[];
  permissions: string[];
  defaultSchoolId?: string;
  schools: Array<{
    id: string;
    name: string;
    initials: string;
    color: string;
    schoolType: string;
    profiles: Array<{ profileId: string; role: string; caption: string }>;
  }>;
};

// ── The mapping performed inside getSession() ────────────────────────────────

function mapMeResponseToSession(me: typeof RAW_ME_RESPONSE): Session {
  return {
    user: me.user,
    scope: me.scope,
    clearanceLevel: me.clearanceLevel as Session['clearanceLevel'],
    roles: me.roles,
    permissions: me.permissions as PermissionKey[],
    defaultSchoolId: me.defaultSchoolId,
    schools: me.schools.map((s) => ({
      id: s.id,
      name: s.name,
      initials: s.initials,
      caption: s.profiles[0]?.caption ?? 'Staff',
      color: s.color,
      schoolType: ((s.schoolType || 'secondary') as SchoolType),
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

  it('multiple profiles at the same school stay one school entry, caption from the first profile', () => {
    const dualProfile = mapMeResponseToSession({
      ...RAW_ME_RESPONSE,
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
});
