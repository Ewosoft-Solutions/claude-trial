import { AcademicStructureService } from './academic-structure.service';

const TENANT = 'tenant-1';
const TEACHER = {
  userId: 'user-1',
  profileId: 'profile-1',
  canViewAll: true,
  canManageAll: false,
};
const ADMIN = {
  ...TEACHER,
  canManageAll: true,
};

function makeService() {
  const client = {
    course: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    class: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const access = {
    getTaughtCourseIds: jest.fn().mockResolvedValue(['course-1']),
    getTaughtClassIds: jest.fn().mockResolvedValue(['class-1', 'class-2']),
  };

  const service = new AcademicStructureService(
    { client } as never,
    { isScoped: false, client } as never,
    {} as never,
    access as never,
  );

  return { service, client, access };
}

describe('AcademicStructureService assignment-scoped lists', () => {
  it('limits teacher course lists to actively taught courses', async () => {
    const { service, client, access } = makeService();

    await service.listCourses(TENANT, undefined, 'active', TEACHER);

    expect(access.getTaughtCourseIds).toHaveBeenCalledWith(
      TENANT,
      TEACHER.profileId,
    );
    expect(client.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          status: 'active',
          AND: [{ id: { in: ['course-1'] } }],
        }),
      }),
    );
  });

  it('limits teacher class lists to actively taught classes', async () => {
    const { service, client, access } = makeService();

    await service.listClasses(
      TENANT,
      { page: 1, limit: 100, status: 'active' },
      TEACHER,
    );

    expect(access.getTaughtClassIds).toHaveBeenCalledWith(
      TENANT,
      TEACHER.profileId,
    );
    expect(client.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          academicYear: { tenantId: TENANT },
          status: 'active',
          AND: [{ id: { in: ['class-1', 'class-2'] } }],
        }),
        take: 100,
      }),
    );
    expect(client.class.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ id: { in: ['class-1', 'class-2'] } }],
        }),
      }),
    );
  });

  it('does not narrow admin course or class lists', async () => {
    const { service, client, access } = makeService();

    await service.listCourses(TENANT, undefined, 'active', ADMIN);
    await service.listClasses(TENANT, { page: 1, limit: 100 }, ADMIN);

    expect(access.getTaughtCourseIds).not.toHaveBeenCalled();
    expect(access.getTaughtClassIds).not.toHaveBeenCalled();
    expect(client.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ AND: expect.anything() }),
      }),
    );
    expect(client.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ AND: expect.anything() }),
      }),
    );
  });
});
