/**
 * MakerCheckerService — separation-of-duties enforcement.
 *
 * These tests pin the two controls the platform approval flow depends on, both
 * of which were missing before 0.5.4: a maker can never approve their own
 * request, and the checker must clear the (possibly distinct) checker floor.
 */
import { ApprovalStatus } from '@workspace/api';
import { MakerCheckerService } from './maker-checker.service';

type Row = {
  id: string;
  operation: string;
  status: string;
  makerId: string;
  expiresAt: Date | null;
  requestData: unknown;
};

function prismaWith(row: Row | null) {
  const update = jest.fn().mockResolvedValue({ ...row, status: 'approved' });
  const roleUpdate = jest.fn().mockResolvedValue({});
  const prisma = {
    makerCheckerRequest: {
      findUnique: jest.fn().mockResolvedValue(row),
      update,
    },
    role: { update: roleUpdate },
  };
  return { prisma, update };
}

function pendingRow(over: Partial<Row> = {}): Row {
  return {
    id: 'req-1',
    operation: 'tenant.act',
    status: ApprovalStatus.PENDING,
    makerId: 'super-admin',
    expiresAt: null,
    requestData: { targetTenantId: 't1', status: 'suspended' },
    ...over,
  };
}

describe('MakerCheckerService.approveRequest', () => {
  const svc = new MakerCheckerService();

  it('refuses self-approval even for an Architect', async () => {
    const { prisma, update } = prismaWith(pendingRow({ makerId: 'architect' }));

    const res = await svc.approveRequest(
      prisma as never,
      'req-1',
      'architect', // same person who raised it
      10,
      undefined,
      { override: true }, // override does NOT lift the maker≠checker rule
    );

    expect(res.approved).toBe(false);
    expect(res.error).toMatch(/cannot approve your own request/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a checker below the checker floor (SuperAdmin cannot approve tenant.act)', async () => {
    const { prisma, update } = prismaWith(pendingRow());

    // tenant.act requires a checker at clearance 10; a second SuperAdmin (9)
    // is not enough — the point is that only an Architect disposes.
    const res = await svc.approveRequest(
      prisma as never,
      'req-1',
      'other-super-admin',
      9,
    );

    expect(res.approved).toBe(false);
    expect(res.error).toMatch(/insufficient clearance/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('approves when a different Architect clears the floor', async () => {
    const { prisma, update } = prismaWith(pendingRow());

    const res = await svc.approveRequest(
      prisma as never,
      'req-1',
      'architect',
      10,
      'looks good',
    );

    expect(res.approved).toBe(true);
    expect(update).toHaveBeenCalled();
  });

  it('override lets a lower checker clear the floor — but still not self-approve', async () => {
    // A clearance-9 holder of platform.approvals.override may approve a request
    // they did not raise, even though the floor is 10.
    const { prisma, update } = prismaWith(pendingRow());

    const res = await svc.approveRequest(
      prisma as never,
      'req-1',
      'delegated-approver',
      9,
      undefined,
      { override: true },
    );

    expect(res.approved).toBe(true);
    expect(update).toHaveBeenCalled();
  });

  it('reports the distinct checker floor via getRequiredCheckerClearanceLevel', () => {
    // tenant.act: maker floor 9, checker floor 10 — the split is the control.
    expect(svc.getRequiredCheckerClearanceLevel('tenant.act')).toBe(10);
    // A legacy op without a distinct checker floor falls back to its single level.
    expect(svc.getRequiredCheckerClearanceLevel('students.delete')).toBe(7);
  });
});
