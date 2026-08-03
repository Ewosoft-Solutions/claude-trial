import { PeopleDirectoryService } from './people-directory.service';

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Okafor',
    preferredName: null,
    createdAt: new Date('2026-01-01'),
    userTenantId: 'ut1',
    contactPoints: [{ kind: 'email', value: 'ada@example.test' }],
    studentProfile: {
      studentNumber: 'STU-001',
      gradeLevel: 'SS1',
      enrollmentStatus: 'active',
    },
    staffProfiles: [] as unknown[],
    guardianships: [] as unknown[],
    account: { status: 'active', user: { email: 'ada@example.test' } },
    ...overrides,
  };
}

function prospectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    applicantName: 'Chidi Eze',
    applyingFor: 'JSS1',
    guardianName: 'Ngozi Eze',
    guardianEmail: 'ngozi@example.test',
    guardianPhone: '08030000000',
    stage: 'application',
    decision: 'pending',
    submittedDate: new Date('2026-02-01'),
    ...overrides,
  };
}

describe('PeopleDirectoryService', () => {
  const personCount = jest.fn();
  const personFindMany = jest.fn();
  const admissionCount = jest.fn();
  const admissionFindMany = jest.fn();
  const write = jest.fn();
  const client = {
    person: { count: personCount, findMany: personFindMany },
    admissionApplication: {
      count: admissionCount,
      findMany: admissionFindMany,
    },
  };
  const service = new PeopleDirectoryService(
    { client } as never,
    { write } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    personCount.mockResolvedValue(1);
    personFindMany.mockResolvedValue([personRow()]);
    admissionCount.mockResolvedValue(1);
    admissionFindMany.mockResolvedValue([prospectRow()]);
    write.mockResolvedValue(true);
  });

  it('never selects health / safeguarding / personal narrative columns', async () => {
    await service.list('t1', 'student', true, {});
    const select = personFindMany.mock.calls[0][0].select;
    for (const forbidden of [
      'healthInfo',
      'health_info',
      'personalInfo',
      'academicInfo',
      'specialNeeds',
      'emergencyContacts',
    ]) {
      expect(select).not.toHaveProperty(forbidden);
      expect(select.studentProfile.select).not.toHaveProperty(forbidden);
    }
  });

  it('returns raw contact + student projection when the caller may view PII', async () => {
    const res = await service.list('t1', 'student', true, {});
    expect(res.meta).toEqual({ canViewContact: true, type: 'student' });
    expect(res.data[0]).toMatchObject({
      name: 'Ada Okafor',
      contact: 'ada@example.test',
      contactMasked: false,
      primary: 'STU-001',
      secondary: 'SS1',
      status: 'active',
    });
    // One identity lists every profile it holds.
    expect(res.data[0].profiles).toEqual(['student', 'user']);
  });

  it('masks the contact when the caller lacks the contact scope', async () => {
    const res = await service.list('t1', 'student', false, {});
    expect(res.data[0].contactMasked).toBe(true);
    expect(res.data[0].contact).not.toBe('ada@example.test');
    expect(res.data[0].contact).toContain('*');
  });

  it('falls contact back to the login email only when no ContactPoint exists', async () => {
    personFindMany.mockResolvedValue([personRow({ contactPoints: [] })]);
    const res = await service.list('t1', 'user', true, {});
    expect(res.data[0].contact).toBe('ada@example.test');
  });

  it('shows every profile a single identity holds (staff + guardian acceptance)', async () => {
    personFindMany.mockResolvedValue([
      personRow({
        staffProfiles: [
          {
            employeeNumber: 'EMP-1',
            jobTitle: 'Teacher',
            department: 'Science',
            employmentStatus: 'active',
          },
        ],
        guardianships: [
          {
            relationship: 'parent',
            isPrimary: true,
            ward: { firstName: 'Kless', lastName: 'Okafor' },
          },
        ],
      }),
    ]);
    // Queried on the Staff tab, but the row still surfaces all four profiles.
    const res = await service.list('t1', 'staff', true, {});
    expect(res.data[0].profiles).toEqual([
      'student',
      'guardian',
      'staff',
      'user',
    ]);
  });

  it('projects the staff tab from the most-recent employment', async () => {
    personFindMany.mockResolvedValue([
      personRow({
        staffProfiles: [
          {
            employeeNumber: 'EMP-1',
            jobTitle: 'Head of Science',
            department: 'Science',
            employmentStatus: 'on_leave',
          },
        ],
      }),
    ]);
    const res = await service.list('t1', 'staff', true, {});
    expect(res.data[0]).toMatchObject({
      primary: 'Head of Science',
      secondary: 'Science',
      status: 'on_leave',
    });
  });

  it('narrows the selected staff employment to the status filter (chip matches filter)', async () => {
    await service.list('t1', 'staff', true, { status: 'active' });
    expect(personFindMany.mock.calls[0][0].select.staffProfiles.where).toEqual({
      employmentStatus: 'active',
    });

    // Without a status filter the most-recent employment is shown unfiltered.
    jest.clearAllMocks();
    personFindMany.mockResolvedValue([personRow()]);
    await service.list('t1', 'staff', true, {});
    expect(
      personFindMany.mock.calls[0][0].select.staffProfiles.where,
    ).toBeUndefined();
  });

  it('projects the guardian tab with ward summary + contact priority', async () => {
    personFindMany.mockResolvedValue([
      personRow({
        studentProfile: null,
        guardianships: [
          {
            relationship: 'parent',
            isPrimary: true,
            ward: { firstName: 'Kless', lastName: 'Okafor' },
          },
          {
            relationship: 'parent',
            isPrimary: false,
            ward: { firstName: 'Uche', lastName: 'Okafor' },
          },
        ],
      }),
    ]);
    const res = await service.list('t1', 'guardian', true, {});
    expect(res.data[0]).toMatchObject({
      primary: '2 wards',
      secondary: 'Kless Okafor, Uche Okafor',
      status: 'primary',
    });
  });

  it('builds the per-type existence filter into the where clause', async () => {
    await service.list('t1', 'student', true, {});
    expect(personFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 't1',
      status: 'active',
      studentProfile: { isNot: null },
    });

    jest.clearAllMocks();
    personFindMany.mockResolvedValue([personRow()]);
    await service.list('t1', 'staff', true, { status: 'active' });
    expect(personFindMany.mock.calls[0][0].where.staffProfiles).toEqual({
      some: { employmentStatus: 'active' },
    });

    jest.clearAllMocks();
    personFindMany.mockResolvedValue([personRow()]);
    await service.list('t1', 'guardian', true, {});
    expect(personFindMany.mock.calls[0][0].where.guardianships).toEqual({
      some: { effectiveTo: null },
    });

    jest.clearAllMocks();
    personFindMany.mockResolvedValue([personRow()]);
    await service.list('t1', 'user', true, {});
    expect(personFindMany.mock.calls[0][0].where.account).toEqual({
      isNot: null,
    });
  });

  it('excludes the contact index from search unless the caller may view contact', async () => {
    await service.list('t1', 'student', false, { q: 'victim@x.test' });
    const maskedOr = personFindMany.mock.calls[0][0].where.OR;
    expect(maskedOr).not.toContainEqual(
      expect.objectContaining({ contactPoints: expect.anything() }),
    );

    jest.clearAllMocks();
    personFindMany.mockResolvedValue([personRow()]);
    await service.list('t1', 'student', true, { q: 'ada@example.test' });
    const rawOr = personFindMany.mock.calls[0][0].where.OR;
    expect(rawOr).toContainEqual(
      expect.objectContaining({ contactPoints: expect.anything() }),
    );
  });

  it('scopes every query to the tenant', async () => {
    await service.list('tenant-9', 'student', true, {});
    expect(personCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-9' }),
      }),
    );
  });

  it('projects the prospect tab from AdmissionApplication (masking guardian contact)', async () => {
    const res = await service.list('t1', 'prospect', false, {});
    expect(admissionFindMany).toHaveBeenCalled();
    expect(res.meta.type).toBe('prospect');
    expect(res.data[0]).toMatchObject({
      name: 'Chidi Eze',
      primary: 'JSS1',
      secondary: 'Ngozi Eze',
      status: 'pending',
      contactMasked: true,
      profiles: [],
    });
    expect(res.data[0].contact).not.toBe('ngozi@example.test');
    expect(res.data[0].contact).toContain('*');
  });

  it('lists every person on the All tab with no profile-existence filter', async () => {
    await service.list('t1', 'all', true, {});
    expect(personFindMany.mock.calls[0][0].where).toEqual({
      tenantId: 't1',
      status: 'active',
    });
    const res = await service.list('t1', 'all', true, {});
    // Coarse type + account status; the full role set is in `profiles`.
    expect(res.data[0]).toMatchObject({ primary: 'Student', status: 'active' });
    expect(res.data[0].profiles).toEqual(['student', 'user']);
  });

  it('summary counts each requested type (all + person tabs + prospect)', async () => {
    personCount.mockReset();
    personCount.mockResolvedValueOnce(26).mockResolvedValueOnce(8);
    admissionCount.mockResolvedValueOnce(7);
    const res = await service.summary('t1', ['all', 'student', 'prospect']);
    expect(res).toEqual({ all: 26, student: 8, prospect: 7 });
    // 'all' counts every person, no profile filter.
    expect(personCount.mock.calls[0][0].where).toEqual({
      tenantId: 't1',
      status: 'active',
    });
    // 'student' counts via the existence filter.
    expect(personCount.mock.calls[1][0].where.studentProfile).toEqual({
      isNot: null,
    });
  });

  describe('export', () => {
    it('produces per-type CSV, honours masking, and writes an audit row', async () => {
      const result = await service.export('t1', 'staff', 'u1', false, ['p1']);
      expect(result.mimeType).toBe('text/csv');
      const [header] = result.content.split('\r\n');
      expect(header).toBe('Name,Role,Department,Employment,Profiles,Contact');
      expect(result.content).not.toContain('ada@example.test'); // masked
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'directory.people.export',
          tenantId: 't1',
          metadata: expect.objectContaining({
            type: 'staff',
            count: 1,
            contactMasked: true,
          }),
        }),
      );
    });

    it('neutralizes CSV formula/DDE injection in user-controlled fields', async () => {
      personFindMany.mockResolvedValue([
        personRow({
          firstName: '=HYPERLINK("http://evil","x")',
          lastName: '',
        }),
      ]);
      const result = await service.export('t1', 'student', 'u1', true, ['p1']);
      expect(result.content).toContain(`'=HYPERLINK`);
      expect(result.content).not.toMatch(/(^|,|")=HYPERLINK/m);
    });
  });
});
