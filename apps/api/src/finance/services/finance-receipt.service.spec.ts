import { FinanceReceiptService } from './finance-receipt.service';

/**
 * The family-checkout writer. What matters here is what it refuses (allocating
 * more than was received, or more than an invoice owes) and what it does with
 * the remainder (holds it as credit, never as income) — plus the shape of the
 * journal entry behind a receipt that covers two children.
 */
describe('FinanceReceiptService.recordReceipt', () => {
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  const billingHousehold = { findFirst: jest.fn() };
  const householdPayer = { findFirst: jest.fn() };
  const payment = { create: jest.fn(), findFirst: jest.fn() };
  const paymentAllocation = { create: jest.fn() };
  const client = {
    feeInvoice,
    billingHousehold,
    householdPayer,
    payment,
    paymentAllocation,
  };

  const numbering = { next: jest.fn() };
  const credits = { createFromOverpayment: jest.fn(), availableCredit: jest.fn() };
  const ledger = { post: jest.fn() };
  const audit = { write: jest.fn() };

  const service = new FinanceReceiptService(
    { client } as never,
    numbering as never,
    credits as never,
    ledger as never,
    audit as never,
  );

  /** An issued invoice with `outstanding` kobo still owed. */
  const invoice = (id: string, outstanding: number, student: string) => ({
    id,
    invoiceNumber: `INV-${id}`,
    status: 'issued',
    dueDate: null,
    householdId: 'hh-1',
    studentId: student,
    studentName: student,
    lines: [{ amount: outstanding, quantity: 1 }],
    adjustments: [],
    allocations: [],
    creditApplications: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    numbering.next.mockResolvedValue('RCT-2026-000001');
    billingHousehold.findFirst.mockResolvedValue({ id: 'hh-1', name: 'Okonkwo' });
    householdPayer.findFirst.mockResolvedValue({ payerName: 'Mrs Okonkwo' });
    payment.create.mockImplementation(async ({ data }: any) => ({
      id: 'rct-1',
      ...data,
    }));
    payment.findFirst.mockResolvedValue({
      id: 'rct-1',
      amount: 0,
      allocations: [],
      credits: [],
    });
    feeInvoice.update.mockImplementation(async ({ where }: any) => ({
      id: where.id,
    }));
  });

  const dto = (overrides: Record<string, unknown> = {}) => ({
    householdId: 'hh-1',
    method: 'transfer' as const,
    paidAt: '2026-08-19',
    amount: 300_000,
    allocations: [
      { invoiceId: 'inv-a', amount: 200_000 },
      { invoiceId: 'inv-b', amount: 100_000 },
    ],
    ...overrides,
  });

  it('settles two siblings from one receipt and credits each invoice separately', async () => {
    feeInvoice.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'inv-a'
        ? invoice('inv-a', 200_000, 'Chidi')
        : invoice('inv-b', 150_000, 'Ada'),
    );

    await service.recordReceipt('t1', dto(), 'user-1');

    const allocated = paymentAllocation.create.mock.calls.map((c) => c[0].data);
    expect(allocated).toEqual([
      expect.objectContaining({ invoiceId: 'inv-a', amount: 200_000 }),
      expect.objectContaining({ invoiceId: 'inv-b', amount: 100_000 }),
    ]);

    // One cash debit, one receivable credit per invoice — so the ledger can
    // still answer "which child did this naira settle?".
    const posted = ledger.post.mock.calls[0][1];
    expect(posted.lines).toEqual([
      expect.objectContaining({ account: 'cash', debit: 300_000 }),
      expect.objectContaining({ account: 'ar_control', credit: 200_000, invoiceId: 'inv-a' }),
      expect.objectContaining({ account: 'ar_control', credit: 100_000, invoiceId: 'inv-b' }),
    ]);
    expect(credits.createFromOverpayment).not.toHaveBeenCalled();
  });

  it('holds the unallocated remainder as credit, not as income', async () => {
    feeInvoice.findFirst.mockResolvedValue(invoice('inv-a', 200_000, 'Chidi'));

    await service.recordReceipt(
      't1',
      dto({
        amount: 250_000,
        allocations: [{ invoiceId: 'inv-a', amount: 200_000 }],
      }),
      'user-1',
    );

    expect(credits.createFromOverpayment).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ amount: 50_000, paymentId: 'rct-1' }),
      'user-1',
    );
    const posted = ledger.post.mock.calls[0][1];
    expect(posted.lines).toContainEqual(
      expect.objectContaining({ account: 'unapplied_credit', credit: 50_000 }),
    );
  });

  it('refuses to allocate more than was received', async () => {
    await expect(
      service.recordReceipt('t1', dto({ amount: 250_000 }), 'user-1'),
    ).rejects.toThrow(/more than the money received/);
    expect(payment.create).not.toHaveBeenCalled();
  });

  it('refuses to allocate more than an invoice actually owes', async () => {
    feeInvoice.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === 'inv-a'
        ? invoice('inv-a', 50_000, 'Chidi')
        : invoice('inv-b', 150_000, 'Ada'),
    );

    await expect(service.recordReceipt('t1', dto(), 'user-1')).rejects.toThrow(
      /only has 50000 kobo outstanding/,
    );
    expect(payment.create).not.toHaveBeenCalled();
  });

  it('refuses to take payment against a draft invoice', async () => {
    feeInvoice.findFirst.mockResolvedValue({
      ...invoice('inv-a', 200_000, 'Chidi'),
      status: 'draft',
    });

    await expect(
      service.recordReceipt(
        't1',
        dto({ allocations: [{ invoiceId: 'inv-a', amount: 200_000 }], amount: 200_000 }),
        'user-1',
      ),
    ).rejects.toThrow(/is draft — issue it before taking payment/);
  });

  it('refuses the same invoice twice on one receipt', async () => {
    await expect(
      service.recordReceipt(
        't1',
        dto({
          allocations: [
            { invoiceId: 'inv-a', amount: 100_000 },
            { invoiceId: 'inv-a', amount: 100_000 },
          ],
        }),
        'user-1',
      ),
    ).rejects.toThrow(/appears twice/);
  });

  it('snapshots the household’s current primary payer when none is given', async () => {
    feeInvoice.findFirst.mockResolvedValue(invoice('inv-a', 300_000, 'Chidi'));

    await service.recordReceipt(
      't1',
      dto({ allocations: [{ invoiceId: 'inv-a', amount: 300_000 }] }),
      'user-1',
    );

    expect(payment.create.mock.calls[0][0].data.payerName).toBe('Mrs Okonkwo');
  });
});
