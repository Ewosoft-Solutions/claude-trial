import { StudentService, STUDENT_ROSTER_MAX } from './student.service';

/**
 * `roster` backs the pages that need the whole student list for aggregates and
 * id→name maps (analytics, finance reports, attendance, fees). It replaced the
 * `?limit=1000` abuse of the paginated list endpoint (which capped at 100 and
 * 400'd). These tests pin the two properties that matter: it is bounded and
 * un-paginated, and its projection stays lightweight (no guardians / roles /
 * contact detail) so pulling every student stays cheap.
 */
describe('StudentService.roster', () => {
  const findMany = jest.fn();
  const client = { student: { findMany } };
  const service = new StudentService(
    { client } as never, // db
    { isScoped: false } as never, // tenantDb (unscoped → uses db.client)
    {} as never, // prismaTx
    {} as never, // userInvitationService
    {} as never, // queueService
    {} as never, // academicAccess
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([{ id: 'stu-1' }]);
  });

  it('reads every student in the tenant, bounded and un-paginated', async () => {
    const result = await service.roster('tenant-1');

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: 'tenant-1' });
    expect(args.take).toBe(STUDENT_ROSTER_MAX);
    expect(args.skip).toBeUndefined();
    expect(result).toEqual({ data: [{ id: 'stu-1' }] });
  });

  it('projects only the lightweight roster columns (no guardians / roles)', async () => {
    await service.roster('tenant-1');
    const select = findMany.mock.calls[0][0].select;

    // The fields the aggregate/roster callers actually consume.
    expect(select).toMatchObject({
      id: true,
      studentNumber: true,
      gradeLevel: true,
      enrollmentStatus: true,
      createdAt: true,
      withdrawalDate: true,
    });
    expect(select.userTenant.select.user.select).toMatchObject({
      firstName: true,
      lastName: true,
      email: true,
    });
    expect(select.enrollments.select.class.select.course.select).toMatchObject({
      name: true,
      code: true,
    });

    // Heavy / sensitive branches of the detailed include must NOT be pulled.
    expect(select.guardians).toBeUndefined();
    expect(select.userTenant.select.userTenantRole).toBeUndefined();
  });
});

describe('StudentService.list ordering', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const client = { student: { findMany, count } };
  const service = new StudentService(
    { client } as never,
    { isScoped: false } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it('defaults to newest-first when no sort is requested', async () => {
    await service.list('tenant-1', {});
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }]);
  });

  it('honours an allow-listed sort (name → last/first, with direction)', async () => {
    await service.list('tenant-1', { sortBy: 'name', sortOrder: 'desc' });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { userTenant: { user: { lastName: 'desc' } } },
      { userTenant: { user: { firstName: 'desc' } } },
    ]);
  });

  it('ignores an unknown sort field (falls back to default order)', async () => {
    await service.list('tenant-1', { sortBy: 'healthInfo', sortOrder: 'asc' });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }]);
  });
});
