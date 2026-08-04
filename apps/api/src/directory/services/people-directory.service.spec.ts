import { PeopleDirectoryService } from './people-directory.service';

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Okafor',
    preferredName: null,
    createdAt: new Date('2026-01-01'),
    userTenantId: 'ut1',
    contactPoints: [
      { kind: 'email', value: 'ada@example.test' },
      { kind: 'phone', value: '08030000001' },
    ],
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

/** A row shaped like the richer DETAIL_SELECT payload (both relation sides). */
function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Okafor',
    preferredName: null,
    userTenantId: 'ut1',
    dateOfBirth: new Date('2010-05-01'),
    gender: 'female',
    nationality: 'NG',
    stateOfOrigin: 'Lagos',
    lgaOfOrigin: 'Ikeja',
    contactPoints: [
      {
        kind: 'email',
        value: 'ada@example.test',
        label: null,
        isPrimary: true,
        verifiedAt: new Date('2025-01-01'),
      },
      {
        kind: 'phone',
        value: '08030000001',
        label: 'mobile',
        isPrimary: false,
        verifiedAt: null,
      },
    ],
    addresses: [] as unknown[],
    studentProfile: {
      id: 'stu1',
      studentNumber: 'STU-001',
      gradeLevel: 'SS1',
      enrollmentStatus: 'active',
      admissionDate: new Date('2024-09-01'),
      enrollmentDate: new Date('2024-09-01'),
      graduationDate: null,
      withdrawalDate: null,
      transferDate: null,
    },
    staffProfiles: [] as unknown[],
    guardianships: [] as unknown[], // this person as a guardian → wards
    wardLinks: [] as unknown[], // this person as a ward → guardians
    account: {
      status: 'active',
      addedAt: new Date('2024-08-01'),
      user: {
        email: 'ada@example.test',
        lastLoginAt: new Date('2026-01-01'),
      },
      userTenantRole: { role: { name: 'Student' } },
    },
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
  const personFindFirst = jest.fn();
  const admissionCount = jest.fn();
  const admissionFindMany = jest.fn();
  const admissionFindFirst = jest.fn();
  const studentFindMany = jest.fn();
  const staffProfileFindMany = jest.fn();
  const guardianRelFindMany = jest.fn();
  const contactPrefFindMany = jest.fn();
  const attendanceFindMany = jest.fn();
  const gradeFindMany = jest.fn();
  const enrollmentFindMany = jest.fn();
  const feeInvoiceFindMany = jest.fn();
  const documentFindMany = jest.fn();
  const write = jest.fn();
  const client = {
    person: {
      count: personCount,
      findMany: personFindMany,
      findFirst: personFindFirst,
    },
    admissionApplication: {
      count: admissionCount,
      findMany: admissionFindMany,
      findFirst: admissionFindFirst,
    },
    student: { findMany: studentFindMany },
    staffProfile: { findMany: staffProfileFindMany },
    guardianRelationship: { findMany: guardianRelFindMany },
    contactPreference: { findMany: contactPrefFindMany },
    attendanceRecord: { findMany: attendanceFindMany },
    grade: { findMany: gradeFindMany },
    enrollment: { findMany: enrollmentFindMany },
    feeInvoice: { findMany: feeInvoiceFindMany },
    document: { findMany: documentFindMany },
  };
  const service = new PeopleDirectoryService(
    { client } as never,
    { write } as never,
  );

  const allPerms = {
    students: true,
    staff: true,
    guardians: true,
    users: true,
    academics: true,
    finance: true,
    documents: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    personCount.mockResolvedValue(1);
    personFindMany.mockResolvedValue([personRow()]);
    personFindFirst.mockResolvedValue(detailRow());
    admissionCount.mockResolvedValue(1);
    admissionFindMany.mockResolvedValue([prospectRow()]);
    admissionFindFirst.mockResolvedValue(prospectRow());
    studentFindMany.mockResolvedValue([]);
    staffProfileFindMany.mockResolvedValue([]);
    guardianRelFindMany.mockResolvedValue([]);
    contactPrefFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);
    gradeFindMany.mockResolvedValue([]);
    enrollmentFindMany.mockResolvedValue([]);
    feeInvoiceFindMany.mockResolvedValue([]);
    documentFindMany.mockResolvedValue([]);
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

  it('returns raw email + phone + student projection when the caller may view PII', async () => {
    const res = await service.list('t1', 'student', true, {});
    expect(res.meta).toEqual({ canViewContact: true, type: 'student' });
    expect(res.data[0]).toMatchObject({
      name: 'Ada Okafor',
      email: 'ada@example.test',
      phone: '08030000001',
      contactMasked: false,
      primary: 'STU-001',
      secondary: 'SS1',
      status: 'active',
    });
    // One identity lists every profile it holds.
    expect(res.data[0].profiles).toEqual(['student', 'user']);
  });

  it('masks both email and phone when the caller lacks the contact scope', async () => {
    const res = await service.list('t1', 'student', false, {});
    expect(res.data[0].contactMasked).toBe(true);
    expect(res.data[0].email).not.toBe('ada@example.test');
    expect(res.data[0].email).toContain('*');
    expect(res.data[0].phone).not.toBe('08030000001');
    expect(res.data[0].phone).toContain('*');
  });

  it('falls email back to the login email only when no ContactPoint exists', async () => {
    personFindMany.mockResolvedValue([personRow({ contactPoints: [] })]);
    const res = await service.list('t1', 'user', true, {});
    expect(res.data[0].email).toBe('ada@example.test');
    expect(res.data[0].phone).toBeNull();
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

  it('tokenises a multi-word query so each word matches a name field', async () => {
    await service.list('t1', 'all', false, { q: 'grace ade' });
    const or = personFindMany.mock.calls[0][0].where.OR;
    // The name match is an AND of per-token ORs — so "grace ade" matches
    // firstName "Grace" AND lastName "Adeyemi" (the space-in-query bug fix).
    const andEntry = or.find((c: Record<string, unknown>) => 'AND' in c);
    expect(andEntry.AND).toHaveLength(2);
    expect(andEntry.AND[0].OR).toContainEqual({
      firstName: { contains: 'grace', mode: 'insensitive' },
    });
    expect(andEntry.AND[1].OR).toContainEqual({
      lastName: { contains: 'ade', mode: 'insensitive' },
    });
  });

  it('match=name searches names ONLY — no contact index even with the contact scope', async () => {
    await service.list('t1', 'all', true, { q: 'te', match: 'name' } as never);
    const or = personFindMany.mock.calls[0][0].where.OR;
    // A picker shows names only, so a hidden ".test" email must never match.
    expect(or).not.toContainEqual(
      expect.objectContaining({ contactPoints: expect.anything() }),
    );
    // Still matches the name.
    expect(or.some((c: Record<string, unknown>) => 'AND' in c)).toBe(true);
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
    expect(res.data[0].email).not.toBe('ngozi@example.test');
    expect(res.data[0].email).toContain('*');
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

  describe('filters', () => {
    it('student: grade narrows studentProfile (combined with status)', async () => {
      await service.list('t1', 'student', true, { grade: 'SS1' });
      expect(personFindMany.mock.calls[0][0].where.studentProfile).toEqual({
        is: { gradeLevel: 'SS1' },
      });

      jest.clearAllMocks();
      personFindMany.mockResolvedValue([personRow()]);
      await service.list('t1', 'student', true, {
        status: 'active',
        grade: 'SS1',
      });
      expect(personFindMany.mock.calls[0][0].where.studentProfile).toEqual({
        is: { enrollmentStatus: 'active', gradeLevel: 'SS1' },
      });
    });

    it('staff: department narrows staffProfiles', async () => {
      await service.list('t1', 'staff', true, { department: 'Science' });
      expect(personFindMany.mock.calls[0][0].where.staffProfiles).toEqual({
        some: { department: 'Science' },
      });
    });

    it('guardian: status filters by contact priority', async () => {
      await service.list('t1', 'guardian', true, { status: 'primary' });
      expect(personFindMany.mock.calls[0][0].where.guardianships).toEqual({
        some: { effectiveTo: null, isPrimary: true },
      });

      jest.clearAllMocks();
      personFindMany.mockResolvedValue([personRow()]);
      await service.list('t1', 'guardian', true, { status: 'secondary' });
      expect(personFindMany.mock.calls[0][0].where.guardianships).toEqual({
        some: { effectiveTo: null, isPrimary: false },
      });
    });

    it('all: role filters by profile existence, status by account status', async () => {
      await service.list('t1', 'all', true, {
        role: 'staff',
        status: 'active',
      });
      const where = personFindMany.mock.calls[0][0].where;
      expect(where.staffProfiles).toEqual({ some: {} });
      expect(where.account).toEqual({ is: { status: 'active' } });
    });

    it('has-contact filters on contact-point presence', async () => {
      await service.list('t1', 'all', true, { hasContact: 'true' });
      expect(personFindMany.mock.calls[0][0].where.contactPoints).toEqual({
        some: {},
      });

      jest.clearAllMocks();
      personFindMany.mockResolvedValue([personRow()]);
      await service.list('t1', 'all', true, { hasContact: 'false' });
      expect(personFindMany.mock.calls[0][0].where.contactPoints).toEqual({
        none: {},
      });
    });
  });

  describe('facets', () => {
    it('returns distinct non-null grades + departments', async () => {
      studentFindMany.mockResolvedValue([
        { gradeLevel: 'JSS1' },
        { gradeLevel: 'SS1' },
      ]);
      staffProfileFindMany.mockResolvedValue([
        { department: 'Science' },
        { department: 'Admin' },
      ]);
      const res = await service.facets('t1');
      expect(res).toEqual({
        grades: ['JSS1', 'SS1'],
        departments: ['Science', 'Admin'],
      });
      expect(studentFindMany.mock.calls[0][0]).toMatchObject({
        where: { tenantId: 't1', gradeLevel: { not: null } },
        distinct: ['gradeLevel'],
      });
    });
  });

  describe('detail', () => {
    it('includes only the permitted sections, masking contact', async () => {
      personFindFirst.mockResolvedValue(
        detailRow({
          staffProfiles: [
            {
              employeeNumber: 'EMP-1',
              jobTitle: 'Teacher',
              department: 'Science',
              employmentStatus: 'active',
              employmentType: 'full_time',
            },
          ],
          wardLinks: [
            {
              relationship: 'parent',
              isPrimary: true,
              guardian: {
                id: 'g1',
                firstName: 'Ngozi',
                lastName: 'Okafor',
                preferredName: null,
              },
            },
          ],
        }),
      );
      const res = await service.detail(
        't1',
        'p1',
        'all',
        {
          students: true,
          staff: false,
          guardians: true,
          users: false,
          academics: false,
          finance: false,
          documents: false,
        },
        false,
      );
      expect(res).not.toBeNull();
      expect(res?.staff).toBeNull(); // staff.view not granted
      expect(res?.account).toBeNull(); // users.view not granted
      expect(res?.student).not.toBeNull(); // students.view granted
      expect(res?.student?.guardians).toEqual([
        {
          id: 'g1',
          name: 'Ngozi Okafor',
          relationship: 'parent',
          isPrimary: true,
        },
      ]);
      expect(res?.contactMasked).toBe(true);
      expect(res?.email).toContain('*');
    });

    it('projects a guardian’s wards when permitted', async () => {
      personFindFirst.mockResolvedValue(
        detailRow({
          studentProfile: null,
          guardianships: [
            {
              relationship: 'parent',
              isPrimary: true,
              ward: {
                id: 'w1',
                firstName: 'Kless',
                lastName: 'Okafor',
                preferredName: null,
              },
            },
          ],
        }),
      );
      const res = await service.detail('t1', 'p1', 'guardian', allPerms, true);
      expect(res?.wards).toEqual([
        {
          id: 'w1',
          name: 'Kless Okafor',
          relationship: 'parent',
          isPrimary: true,
        },
      ]);
      expect(res?.email).toBe('ada@example.test');
    });

    it('returns null when the id is not found', async () => {
      personFindFirst.mockResolvedValue(null);
      const res = await service.detail('t1', 'missing', 'all', allPerms, true);
      expect(res).toBeNull();
    });

    it('projects prospect detail from AdmissionApplication', async () => {
      const res = await service.detail('t1', 'a1', 'prospect', allPerms, true);
      expect(admissionFindFirst).toHaveBeenCalled();
      expect(res?.type).toBe('prospect');
      expect(res?.prospect).toMatchObject({
        applyingFor: 'JSS1',
        guardianName: 'Ngozi Eze',
        decision: 'pending',
      });
    });

    it('derives siblings from the student’s shared guardians', async () => {
      personFindFirst.mockResolvedValue(
        detailRow({
          wardLinks: [
            {
              relationship: 'parent',
              isPrimary: true,
              guardian: {
                id: 'g1',
                firstName: 'Ngozi',
                lastName: 'Okafor',
                preferredName: null,
              },
            },
          ],
        }),
      );
      guardianRelFindMany.mockResolvedValue([
        {
          ward: {
            id: 'sib1',
            firstName: 'Uche',
            lastName: 'Okafor',
            preferredName: null,
          },
        },
      ]);
      const res = await service.detail('t1', 'p1', 'student', allPerms, true);
      expect(res?.student?.siblings).toEqual([
        {
          id: 'sib1',
          name: 'Uche Okafor',
          relationship: 'sibling',
          isPrimary: false,
        },
      ]);
      expect(res?.flags.hasSiblings).toBe(true);
    });

    it('gates the finance / academics / documents roll-ups on permission', async () => {
      feeInvoiceFindMany.mockResolvedValue([
        {
          amountDue: 1000,
          amountPaid: 400,
          status: 'overdue',
          dueDate: new Date('2026-03-01'),
        },
      ]);
      attendanceFindMany.mockResolvedValue([
        { status: 'present' },
        { status: 'absent' },
      ]);
      gradeFindMany.mockResolvedValue([{ percentage: 80 }, { percentage: 90 }]);
      documentFindMany.mockResolvedValue([
        {
          id: 'd1',
          title: 'Birth cert',
          scanStatus: 'clean',
          createdAt: new Date('2026-01-01'),
          type: { label: 'Birth Certificate' },
        },
      ]);

      const ok = await service.detail('t1', 'p1', 'student', allPerms, true);
      expect(ok?.finance).toMatchObject({ balance: 600, overdueCount: 1 });
      expect(ok?.academics).toMatchObject({
        attendancePercent: 50,
        averageGradePercent: 85,
      });
      expect(ok?.documents?.count).toBe(1);
      expect(ok?.flags.feesOverdue).toBe(true);

      const denied = await service.detail(
        't1',
        'p1',
        'student',
        { ...allPerms, finance: false, documents: false, academics: false },
        true,
      );
      expect(denied?.finance).toBeNull();
      expect(denied?.academics).toBeNull();
      expect(denied?.documents).toBeNull();
    });

    it('builds the admission timeline for a prospect', async () => {
      admissionFindFirst.mockResolvedValue(
        prospectRow({ stage: 'interview', decision: 'pending' }),
      );
      const res = await service.detail('t1', 'a1', 'prospect', allPerms, true);
      expect(res?.timeline.map((s) => s.key)).toEqual([
        'submitted',
        'interview',
        'decision',
      ]);
      expect(res?.timeline.find((s) => s.key === 'submitted')?.state).toBe(
        'done',
      );
      expect(res?.timeline.find((s) => s.key === 'interview')?.state).toBe(
        'current',
      );
    });
  });

  describe('export', () => {
    it('produces per-type CSV, honours masking, and writes an audit row', async () => {
      const result = await service.export('t1', 'staff', 'u1', false, ['p1']);
      expect(result.mimeType).toBe('text/csv');
      const [header] = result.content.split('\r\n');
      expect(header).toBe(
        'Name,Role,Department,Employment,Profiles,Email,Phone',
      );
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
