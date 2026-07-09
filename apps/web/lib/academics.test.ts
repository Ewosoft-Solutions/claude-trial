import { describe, expect, it } from 'vitest';

import { profileHasRole, staffRoleAssignments, type StaffProfile } from './academics';

function staffProfile(
  userTenantRole: StaffProfile['userTenantRole'],
): StaffProfile {
  return {
    id: 'profile-1',
    status: 'active',
    user: {
      id: 'user-1',
      email: 'teacher@example.test',
      firstName: 'Ada',
      lastName: 'Teacher',
    },
    userTenantRole,
  };
}

describe('staffRoleAssignments', () => {
  it('normalizes the current single userTenantRole relation', () => {
    const profile = staffProfile({
      role: { id: 'role-1', name: 'Teacher', clearanceLevel: 3 },
    });

    expect(staffRoleAssignments(profile)).toHaveLength(1);
    expect(profileHasRole(profile, 'teacher')).toBe(true);
  });

  it('keeps compatibility with older array-shaped role payloads', () => {
    const profile = staffProfile([
      { role: { id: 'role-1', name: 'Teacher', clearanceLevel: 3 } },
      { role: { id: 'role-2', name: 'Advisor', clearanceLevel: 2 } },
    ]);

    expect(staffRoleAssignments(profile)).toHaveLength(2);
    expect(profileHasRole(profile, 'advisor')).toBe(true);
  });

  it('handles profiles without a role relation', () => {
    const profile = staffProfile(null);

    expect(staffRoleAssignments(profile)).toEqual([]);
    expect(profileHasRole(profile, 'teacher')).toBe(false);
  });
});
