import { StaffEmploymentService } from './staff-employment.service';

/**
 * Unit coverage for the guard branches that don't need a database: person
 * lifecycle, invalid-transition, and reporting-line self/validation. The full
 * happy path + cycle detection + RLS isolation are proven on real pg in
 * test/staff-employment.e2e-spec.ts.
 */
function makeService() {
  const personFindFirst = jest.fn();
  const staffFindFirst = jest.fn();
  const staffCreate = jest.fn();
  const staffUpdate = jest.fn();
  const write = jest.fn();
  const client = {
    person: { findFirst: personFindFirst },
    staffProfile: {
      findFirst: staffFindFirst,
      create: staffCreate,
      update: staffUpdate,
    },
  };
  const service = new StaffEmploymentService(
    { client } as never,
    { write } as never,
  );
  return {
    service,
    personFindFirst,
    staffFindFirst,
    staffCreate,
    staffUpdate,
    write,
  };
}

describe('StaffEmploymentService', () => {
  it('refuses to open an employment for a non-active person', async () => {
    const { service, personFindFirst, staffCreate } = makeService();
    personFindFirst.mockResolvedValue({
      id: 'p1',
      status: 'merged',
      firstName: 'A',
      lastName: 'B',
    });
    await expect(
      service.create('t1', 'actor', 'p1', { jobTitle: 'Bursar' }),
    ).rejects.toThrow(/not active/i);
    expect(staffCreate).not.toHaveBeenCalled();
  });

  it('rejects an employment that reports to itself', async () => {
    const { service, staffFindFirst } = makeService();
    // loadEmployment lookup succeeds…
    staffFindFirst.mockResolvedValueOnce({
      id: 'e1',
      personId: 'p1',
      employmentStatus: 'active',
    });
    await expect(
      service.update('t1', 'actor', 'e1', { reportsToStaffProfileId: 'e1' }),
    ).rejects.toThrow(/itself/i);
  });

  it('refuses to disable an already-ended employment', async () => {
    const { service, staffFindFirst, staffUpdate } = makeService();
    staffFindFirst.mockResolvedValue({
      id: 'e1',
      personId: 'p1',
      employmentStatus: 'terminated',
    });
    await expect(service.disable('t1', 'actor', 'e1', {})).rejects.toThrow(
      /already ended/i,
    );
    expect(staffUpdate).not.toHaveBeenCalled();
  });

  it('rejects an invalid hire date', async () => {
    const { service, personFindFirst } = makeService();
    personFindFirst.mockResolvedValue({
      id: 'p1',
      status: 'active',
      firstName: 'A',
      lastName: 'B',
    });
    await expect(
      service.create('t1', 'actor', 'p1', { hireDate: 'not-a-date' }),
    ).rejects.toThrow(/invalid date/i);
  });
});
