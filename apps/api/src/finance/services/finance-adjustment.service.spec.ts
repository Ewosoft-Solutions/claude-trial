import { FinanceAdjustmentService } from './finance-adjustment.service';

/**
 * The authority + auto-apply logic that makes discounts auditable: a
 * discretionary adjustment raises a maker-checker request and only becomes
 * `applied` on approval; policy activation is likewise gated; and an active
 * policy auto-applies to a matching invoice with the right computed amount.
 */
describe('FinanceAdjustmentService', () => {
  const feeInvoice = { findFirst: jest.fn() };
  const feeAdjustment = {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  };
  const discountPolicy = {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  const client = { feeInvoice, feeAdjustment, discountPolicy };
  // The ledger is the collaborator that turns an APPLIED adjustment into a
  // posted contra pair; here we only assert that it is asked to.
  const ledger = { post: jest.fn(), ensureOpeningBalance: jest.fn() };
  const makerChecker = {
    createApprovalRequest: jest.fn(),
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
  };
  const service = new FinanceAdjustmentService(
    { client } as never,
    makerChecker as never,
    ledger as never,
  );

  const actor = { userId: 'user-1', clearanceLevel: 5 };

  beforeEach(() => {
    jest.clearAllMocks();
    feeAdjustment.create.mockImplementation(async ({ data }: any) => ({
      id: 'adj-1',
      ...data,
    }));
    feeAdjustment.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      invoiceId: 'inv-1',
      amount: 500_000,
      reason: 'Hardship waiver',
      ...data,
    }));
    discountPolicy.create.mockImplementation(async ({ data }: any) => ({
      id: 'pol-1',
      ...data,
    }));
    discountPolicy.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));
    // `refreshInvoiceTotals` re-reads the invoice with its settlement rows
    // before posting; give it the shape the include produces.
    feeInvoice.update = jest.fn(async ({ where, data }: any) => ({
      id: where.id,
      invoiceNumber: 'INV-2026-000001',
      householdId: null,
      studentId: 'stu-1',
      ...data,
    }));
  });

  /** An issued bill with `outstanding` kobo still owed. */
  const outstandingInvoice = (outstanding: number, status = 'issued') => ({
    id: 'inv-1',
    invoiceNumber: 'INV-2026-000001',
    status,
    dueDate: null,
    householdId: null,
    studentId: 'stu-1',
    lines: [{ amount: outstanding, quantity: 1 }],
    adjustments: [],
    allocations: [],
    creditApplications: [],
  });

  it('raises a discretionary adjustment as pending + attaches the approval request', async () => {
    feeInvoice.findFirst.mockResolvedValue(outstandingInvoice(1_000_000));
    makerChecker.createApprovalRequest.mockResolvedValue('appr-1');

    await service.requestAdjustment('t1', actor, {
      invoiceId: 'inv-1',
      type: 'waiver',
      amount: 500000,
    });

    const created = feeAdjustment.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      source: 'discretionary',
      status: 'pending',
      requestedBy: 'user-1',
      amount: 500000,
    });
    expect(makerChecker.createApprovalRequest).toHaveBeenCalledWith(
      expect.anything(),
      'finance.adjustment.discretionary',
      'user-1',
      5,
      expect.objectContaining({ adjustmentId: 'adj-1' }),
      't1',
    );
    expect(feeAdjustment.update.mock.calls[0][0].data).toEqual({
      approvalRequestId: 'appr-1',
    });
  });

  it('applies an adjustment only when the checker approves', async () => {
    feeAdjustment.findFirst.mockResolvedValue({
      id: 'adj-1',
      invoiceId: 'inv-1',
      amount: 500_000,
      status: 'pending',
      approvalRequestId: 'appr-1',
    });
    feeInvoice.findFirst.mockResolvedValue(outstandingInvoice(1_000_000));
    makerChecker.approveRequest.mockResolvedValue({ approved: true });

    await service.approveAdjustment(
      't1',
      { userId: 'user-2', clearanceLevel: 6 },
      'adj-1',
    );

    expect(makerChecker.approveRequest).toHaveBeenCalledWith(
      expect.anything(),
      'appr-1',
      'user-2',
      6,
      undefined,
    );
    expect(feeAdjustment.update.mock.calls[0][0].data).toMatchObject({
      status: 'applied',
      approvedBy: 'user-2',
    });
    // …and the money forgiven leaves the books as a balanced contra pair.
    const posted = ledger.post.mock.calls[0][1];
    expect(posted.sourceType).toBe('adjustment');
    expect(posted.lines).toEqual([
      expect.objectContaining({ account: 'discounts_allowed', debit: 500_000 }),
      expect.objectContaining({ account: 'ar_control', credit: 500_000 }),
    ]);
  });

  it('refuses a waiver larger than what the invoice still owes', async () => {
    feeInvoice.findFirst.mockResolvedValue(outstandingInvoice(100_000));

    await expect(
      service.requestAdjustment('t1', actor, {
        invoiceId: 'inv-1',
        type: 'waiver',
        amount: 500_000,
      }),
    ).rejects.toThrow(/only has 100000 kobo outstanding/);
    expect(feeAdjustment.create).not.toHaveBeenCalled();
  });

  it('refuses an adjustment against a bill that is no longer outstanding', async () => {
    feeInvoice.findFirst.mockResolvedValue(outstandingInvoice(0, 'cancelled'));

    await expect(
      service.requestAdjustment('t1', actor, {
        invoiceId: 'inv-1',
        type: 'waiver',
        amount: 1_000,
      }),
    ).rejects.toThrow(/is cancelled — an adjustment applies only/);
  });

  it('re-checks at APPROVAL, so a waiver cannot outlive the balance it was raised against', async () => {
    feeAdjustment.findFirst.mockResolvedValue({
      id: 'adj-1',
      invoiceId: 'inv-1',
      amount: 500_000,
      status: 'pending',
      approvalRequestId: 'appr-1',
    });
    makerChecker.approveRequest.mockResolvedValue({ approved: true });
    // A receipt settled the invoice while the waiver sat pending.
    feeInvoice.findFirst.mockResolvedValue({
      ...outstandingInvoice(1_000_000),
      allocations: [{ amount: 1_000_000 }],
    });

    await expect(
      service.approveAdjustment(
        't1',
        { userId: 'user-2', clearanceLevel: 6 },
        'adj-1',
      ),
    ).rejects.toThrow(/only has 0 kobo outstanding/);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it('does not apply when the maker-checker rejects the approval', async () => {
    feeAdjustment.findFirst.mockResolvedValue({
      id: 'adj-1',
      status: 'pending',
      approvalRequestId: 'appr-1',
    });
    makerChecker.approveRequest.mockResolvedValue({
      approved: false,
      error: 'maker cannot approve own request',
    });

    await expect(
      service.approveAdjustment('t1', actor, 'adj-1'),
    ).rejects.toThrow(/maker cannot approve/);
    expect(feeAdjustment.update).not.toHaveBeenCalled();
  });

  it('rejects a policy that sets both amount and percent', async () => {
    await expect(
      service.createPolicy('t1', actor, {
        name: 'Sibling',
        type: 'discount',
        amount: 1000,
        percentBps: 1000,
      }),
    ).rejects.toThrow(/exactly one of amount or percentBps/);
    expect(discountPolicy.create).not.toHaveBeenCalled();
  });

  it('auto-applies active policies: fixed capped at base, percent of the matching item', async () => {
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-2026-000001',
      status: 'issued',
      dueDate: null,
      householdId: null,
      studentId: 'stu-1',
      lines: [
        { feeItemId: 'tuition', amount: 1_000_000, quantity: 1 },
        { feeItemId: 'bus', amount: 200_000, quantity: 1 },
      ],
      adjustments: [],
      allocations: [],
      creditApplications: [],
    });
    discountPolicy.findMany.mockResolvedValue([
      {
        id: 'p-pct',
        type: 'discount',
        feeItemId: 'tuition',
        amount: null,
        percentBps: 1000,
        name: '10% tuition',
      },
      {
        id: 'p-fixed',
        type: 'discount',
        feeItemId: 'bus',
        amount: 500_000,
        percentBps: null,
        name: 'Bus subsidy',
      },
    ]);

    const created = await service.applyPoliciesToInvoice('t1', 'inv-1');

    const amounts = feeAdjustment.create.mock.calls.map((c) => c[0].data);
    // 10% of the 1,000,000 tuition line = 100,000
    expect(amounts).toContainEqual(
      expect.objectContaining({
        policyId: 'p-pct',
        source: 'policy',
        amount: 100_000,
        status: 'applied',
      }),
    );
    // fixed 500,000 capped to the 200,000 bus line
    expect(amounts).toContainEqual(
      expect.objectContaining({ policyId: 'p-fixed', amount: 200_000 }),
    );
    expect(created).toHaveLength(2);
  });

  it('is idempotent — skips a policy already applied to the invoice', async () => {
    feeInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      lines: [{ feeItemId: 'tuition', amount: 1_000_000, quantity: 1 }],
      adjustments: [{ policyId: 'p-pct' }],
    });
    discountPolicy.findMany.mockResolvedValue([
      {
        id: 'p-pct',
        type: 'discount',
        feeItemId: null,
        amount: null,
        percentBps: 1000,
        name: '10%',
      },
    ]);

    const created = await service.applyPoliciesToInvoice('t1', 'inv-1');
    expect(created).toHaveLength(0);
    expect(feeAdjustment.create).not.toHaveBeenCalled();
  });
});
