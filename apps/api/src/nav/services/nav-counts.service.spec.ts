/**
 * NavCountsService — the sidebar badge counts.
 *
 * Pins the tenant scoping and the exact query shapes, so the figures stay
 * identical to the OverviewService equivalents they replaced.
 */
import { NavCountsService } from './nav-counts.service';

function build(counts: {
  admissions?: number;
  invoices?: number;
  invitations?: number;
  adjustments?: number;
}) {
  const client = {
    admissionApplication: {
      count: jest.fn().mockResolvedValue(counts.admissions ?? 0),
    },
    feeInvoice: { count: jest.fn().mockResolvedValue(counts.invoices ?? 0) },
    userTenant: { count: jest.fn().mockResolvedValue(counts.invitations ?? 0) },
    feeAdjustment: {
      count: jest.fn().mockResolvedValue(counts.adjustments ?? 0),
    },
  };
  const tenantDb = { client };
  return { service: new NavCountsService(tenantDb as never), client };
}

describe('NavCountsService.getCounts', () => {
  it('returns the actionable counts', async () => {
    const { service } = build({
      admissions: 21,
      invoices: 3,
      invitations: 2,
      adjustments: 4,
    });

    const out = await service.getCounts('t1');

    expect(out).toEqual({
      admissionsPending: 21,
      outstandingInvoices: 3,
      pendingInvitations: 2,
      pendingAdjustments: 4,
    });
  });

  it('scopes every count to the tenant, only outstanding invoice statuses', async () => {
    const { service, client } = build({});

    await service.getCounts('t9');

    expect(client.admissionApplication.count).toHaveBeenCalledWith({
      where: { tenantId: 't9', decision: 'pending' },
    });
    expect(client.feeInvoice.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't9',
        status: { in: ['issued', 'partial', 'overdue'] },
      },
    });
    expect(client.userTenant.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't9',
        invitationToken: { not: null },
        status: 'pending',
      },
    });
    // Policy adjustments are pre-approved and post themselves on issue, so a
    // badge counting them would send someone to a queue of things nobody can
    // act on.
    expect(client.feeAdjustment.count).toHaveBeenCalledWith({
      where: { tenantId: 't9', status: 'pending', source: 'discretionary' },
    });
  });

  it('defaults missing figures to zero (a fresh tenant reports zeros)', async () => {
    const { service } = build({ admissions: 5 });

    const out = await service.getCounts('t1');

    expect(out).toEqual({
      admissionsPending: 5,
      outstandingInvoices: 0,
      pendingInvitations: 0,
      pendingAdjustments: 0,
    });
  });
});
