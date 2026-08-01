import { StudentDirectoryService } from './student-directory.service';
import type { AcademicsActor } from '../../common/academics/academics-access.service';

function actor(overrides: Partial<AcademicsActor> = {}): AcademicsActor {
  return {
    userId: 'user-1',
    profileId: 'profile-1',
    canViewAll: true,
    canManageAll: true,
    ...overrides,
  };
}

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stu-1',
    studentNumber: 'STU-001',
    gradeLevel: 'SS1',
    enrollmentStatus: 'active',
    createdAt: new Date('2026-01-01'),
    userTenant: {
      user: { firstName: 'Ada', lastName: 'Okafor', email: 'ada@example.test' },
    },
    enrollments: [
      {
        class: {
          name: 'SS1 Science',
          section: 'A',
          course: { name: 'Science', code: 'SCI' },
        },
      },
    ],
    guardians: [
      {
        isPrimary: true,
        guardian: { user: { firstName: 'Ngozi', lastName: 'Okafor' } },
      },
    ],
    ...overrides,
  };
}

describe('StudentDirectoryService', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  const groupBy = jest.fn();
  const assertCanManageClass = jest.fn();
  const write = jest.fn();
  const client = {
    student: { count, findMany },
    feeInvoice: { groupBy },
  };
  const service = new StudentDirectoryService(
    { client } as never,
    { assertCanManageClass } as never,
    { write } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([studentRow()]);
    groupBy.mockResolvedValue([]);
    write.mockResolvedValue(true);
  });

  it('never selects health / safeguarding / personal narrative columns', async () => {
    await service.list('tenant-1', actor(), true, {});
    const select = findMany.mock.calls[0][0].select;
    for (const forbidden of [
      'healthInfo',
      'health_info',
      'personalInfo',
      'academicInfo',
      'specialNeeds',
      'emergencyContacts',
    ]) {
      expect(select).not.toHaveProperty(forbidden);
    }
  });

  it('returns the raw contact when the caller may view PII', async () => {
    const res = await service.list('tenant-1', actor(), true, {});
    expect(res.data[0]).toMatchObject({
      contact: 'ada@example.test',
      contactMasked: false,
      name: 'Ada Okafor',
      className: 'SS1 Science',
      guardian: 'Ngozi Okafor',
    });
  });

  it('masks the contact when the caller lacks the PII scope (unauthorized scope)', async () => {
    const res = await service.list('tenant-1', actor(), false, {});
    expect(res.data[0].contactMasked).toBe(true);
    expect(res.data[0].contact).not.toBe('ada@example.test');
    expect(res.data[0].contact).toContain('*');
  });

  it('never falls the name column back to the email (no PII leak via name)', async () => {
    findMany.mockResolvedValue([
      studentRow({
        userTenant: {
          user: { firstName: null, lastName: null, email: 'secret@x.test' },
        },
      }),
    ]);
    // A name-less student must show the (non-PII) student number, never the
    // email — for authorized AND unauthorized callers.
    const unauth = await service.list('tenant-1', actor(), false, {});
    expect(unauth.data[0].name).toBe('STU-001');
    expect(unauth.data[0].name).not.toContain('secret@x.test');
    const auth = await service.list('tenant-1', actor(), true, {});
    expect(auth.data[0].name).toBe('STU-001');
  });

  it('excludes email from search unless the caller may view contact (no oracle)', async () => {
    await service.list('tenant-1', actor(), false, { q: 'victim@x.test' });
    const whereMasked = findMany.mock.calls[0][0].where;
    const userOrMasked = whereMasked.OR[2].userTenant.user.OR;
    expect(userOrMasked).not.toContainEqual(
      expect.objectContaining({ email: expect.anything() }),
    );

    jest.clearAllMocks();
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([studentRow()]);
    groupBy.mockResolvedValue([]);
    await service.list('tenant-1', actor(), true, { q: 'ada@example.test' });
    const userOrRaw = findMany.mock.calls[0][0].where.OR[2].userTenant.user.OR;
    expect(userOrRaw).toContainEqual(
      expect.objectContaining({
        email: { contains: 'ada@example.test', mode: 'insensitive' },
      }),
    );
  });

  it('scopes every query to the tenant', async () => {
    await service.list('tenant-9', actor(), true, {});
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-9' }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-9' }),
      }),
    );
  });

  it('builds status / grade / search filters into the where clause', async () => {
    await service.list('tenant-1', actor(), true, {
      status: 'graduated',
      gradeLevel: 'SS3',
      q: 'oka',
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      enrollmentStatus: 'graduated',
      gradeLevel: 'SS3',
    });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentNumber: { contains: 'oka', mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('maps the sort field + direction to a Prisma orderBy', async () => {
    await service.list('tenant-1', actor(), true, {
      sort: 'name',
      dir: 'desc',
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { userTenant: { user: { lastName: 'desc' } } },
      { userTenant: { user: { firstName: 'desc' } } },
    ]);
  });

  it('enforces class ownership for a non-admin actor filtering by class', async () => {
    await service.list('tenant-1', actor({ canManageAll: false }), true, {
      classId: 'class-1',
    });
    expect(assertCanManageClass).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ canManageAll: false }),
      'class-1',
    );
  });

  it('summarises fees per student from the FeeInvoice aggregate', async () => {
    groupBy.mockResolvedValue([
      { studentId: 'stu-1', _sum: { amountDue: 1000, amountPaid: 400 } },
    ]);
    const res = await service.list('tenant-1', actor(), true, {});
    expect(res.data[0].fee).toEqual({
      amountDue: 1000,
      amountPaid: 400,
      status: 'partial',
    });
  });

  describe('export', () => {
    it('produces CSV, honours masking, and writes an audit row', async () => {
      const result = await service.export('tenant-1', 'user-1', false, [
        'stu-1',
      ]);
      expect(result.mimeType).toBe('text/csv');
      const [header, firstRow] = result.content.split('\r\n');
      expect(header).toBe(
        'Student number,Name,Grade,Status,Class,Guardian,Contact',
      );
      expect(firstRow).toContain('STU-001');
      expect(firstRow).not.toContain('ada@example.test'); // masked
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'directory.students.export',
          tenantId: 'tenant-1',
          metadata: expect.objectContaining({ count: 1, contactMasked: true }),
        }),
      );
    });

    it('quotes CSV fields containing commas', async () => {
      findMany.mockResolvedValue([
        studentRow({
          userTenant: {
            user: {
              firstName: 'Ada, Jr',
              lastName: 'Okafor',
              email: 'a@b.test',
            },
          },
        }),
      ]);
      const result = await service.export('tenant-1', 'user-1', true, [
        'stu-1',
      ]);
      expect(result.content).toContain('"Ada, Jr Okafor"');
    });

    it('neutralizes CSV formula/DDE injection in user-controlled fields', async () => {
      findMany.mockResolvedValue([
        studentRow({
          userTenant: {
            user: {
              firstName: '=HYPERLINK("http://evil","x")',
              lastName: '',
              email: 'a@b.test',
            },
          },
        }),
      ]);
      const result = await service.export('tenant-1', 'user-1', true, [
        'stu-1',
      ]);
      // The dangerous leading '=' must be prefixed with a quote so a
      // spreadsheet treats it as text, not a formula.
      expect(result.content).toContain(`'=HYPERLINK`);
      expect(result.content).not.toMatch(/(^|,|")=HYPERLINK/m);
    });
  });
});
