import type { UserPermissionContext } from '../auth/services/permission.service';
import { SearchService } from './search.service';

function context(permissions: string[]): UserPermissionContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    profileId: 'profile-1',
    roleId: 'role-1',
    clearanceLevel: 3,
    permissions: new Map(
      permissions.map((permission) => [permission, { granted: true }]),
    ),
    permissionIds: [],
  };
}

describe('SearchService', () => {
  const studentFindMany = jest.fn();
  const classFindMany = jest.fn();
  const personFindMany = jest.fn();
  const getTaughtClassIds = jest.fn();
  const client = {
    student: { findMany: studentFindMany },
    class: { findMany: classFindMany },
    userTenant: { findMany: personFindMany },
  };
  const service = new SearchService(
    { client } as never,
    { getTaughtClassIds } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    studentFindMany.mockResolvedValue([]);
    classFindMany.mockResolvedValue([]);
    personFindMany.mockResolvedValue([]);
    getTaughtClassIds.mockResolvedValue(['class-1']);
  });

  it('only queries result types granted to the active profile', async () => {
    personFindMany.mockResolvedValue([
      {
        id: 'profile-2',
        status: 'active',
        user: {
          firstName: 'Mary',
          lastName: 'Johnson',
          email: 'mary@example.test',
        },
        userTenantRole: { role: { name: 'Teacher' } },
      },
    ]);

    const result = await service.search('tenant-1', context(['users.view']), {
      q: 'Mary',
      limit: 5,
    });

    expect(studentFindMany).not.toHaveBeenCalled();
    expect(classFindMany).not.toHaveBeenCalled();
    expect(personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
        take: 5,
      }),
    );
    expect(result.results).toEqual([
      expect.objectContaining({
        kind: 'person',
        title: 'Mary Johnson',
        href: '/settings/users#user-profile-2',
      }),
    ]);
  });

  it('limits teacher academic results to actively taught classes', async () => {
    await service.search(
      'tenant-1',
      context(['students.view', 'schedules.view']),
      { q: 'P6', limit: 4 },
    );

    expect(getTaughtClassIds).toHaveBeenCalledWith('tenant-1', 'profile-1');
    expect(studentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          AND: expect.arrayContaining([
            expect.objectContaining({
              enrollments: {
                some: { classId: { in: ['class-1'] }, status: 'active' },
              },
            }),
          ]),
        }),
      }),
    );
    expect(classFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          id: { in: ['class-1'] },
        }),
      }),
    );
    expect(personFindMany).not.toHaveBeenCalled();
  });
});
