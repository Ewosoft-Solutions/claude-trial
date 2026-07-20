/**
 * HrService unit tests — the staff directory + leave methods (slice 3
 * sub-surfaces). Prisma is stubbed via a fake client.
 */
import { NotFoundException } from '@nestjs/common';
import { HrService } from './hr.service';

function build(options: {
  payroll?: unknown[];
  leaveFindFirst?: unknown;
} = {}) {
  const staffPayrollRecord = {
    findMany: jest.fn().mockResolvedValue(options.payroll ?? []),
  };
  const staffLeaveRequest = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(async ({ data }: any) => ({ id: 'lr1', ...data })),
    findFirst: jest.fn().mockResolvedValue(options.leaveFindFirst ?? null),
    update: jest.fn(async ({ data }: any) => ({ id: 'lr1', ...data })),
  };
  const client = { staffPayrollRecord, staffLeaveRequest };
  const db = { client };
  const tenantDb = { isScoped: false, client };
  return { service: new HrService(db as never, tenantDb as never), staffLeaveRequest };
}

describe('HrService', () => {
  it('collapses payroll rows into one directory entry per staff member', async () => {
    const { service } = build({
      payroll: [
        // Ordered desc by payPeriod (as the query returns them).
        { staffUserTenantId: 'u1', staffName: 'Ada N', role: 'Teacher', payPeriod: '2026-06', status: 'paid' },
        { staffUserTenantId: 'u1', staffName: 'Ada N', role: 'Teacher', payPeriod: '2026-05', status: 'paid' },
        { staffUserTenantId: 'u2', staffName: 'Ben O', role: 'Bursar', payPeriod: '2026-06', status: 'draft' },
      ],
    });
    const dir = await service.directory('t1');
    expect(dir).toHaveLength(2);
    const ada = dir.find((d) => d.staffUserTenantId === 'u1')!;
    expect(ada).toMatchObject({
      staffName: 'Ada N',
      latestPayPeriod: '2026-06',
      recordCount: 2,
    });
  });

  it('creates a pending leave request', async () => {
    const { service, staffLeaveRequest } = build();
    const created = await service.createLeaveRequest(
      't1',
      {
        staffUserTenantId: 'u1',
        staffName: 'Ada N',
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        days: 5,
      },
      'actor',
    );
    expect(created).toMatchObject({ status: 'pending', leaveType: 'annual' });
    expect(staffLeaveRequest.create).toHaveBeenCalled();
  });

  it('reviews a leave request, stamping status + reviewer', async () => {
    const { service, staffLeaveRequest } = build({
      leaveFindFirst: { id: 'lr1', tenantId: 't1', status: 'pending' },
    });
    const reviewed = await service.reviewLeaveRequest(
      't1',
      'lr1',
      { status: 'approved', reviewNote: 'ok' },
      'reviewer',
    );
    expect(reviewed).toMatchObject({ status: 'approved', reviewedBy: 'reviewer' });
    expect(staffLeaveRequest.update).toHaveBeenCalled();
  });

  it('404s when reviewing a missing leave request', async () => {
    const { service } = build({ leaveFindFirst: null });
    await expect(
      service.reviewLeaveRequest('t1', 'missing', { status: 'approved' }, 'r'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
