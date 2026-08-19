import { FinanceCreditService } from './finance-credit.service';

/**
 * Credit is an AR balance, not a wallet: it can only ever be drawn down onto an
 * invoice, oldest first, and it stops exactly at what the invoice owes.
 */
describe('FinanceCreditService', () => {
  const accountCredit = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  };
  const creditApplication = { create: jest.fn() };
  const feeInvoice = { findFirst: jest.fn(), update: jest.fn() };
  // `$queryRawUnsafe` is the row lock taken before either side's balance is read.
  const $queryRawUnsafe = jest.fn().mockResolvedValue([]);
  const client = { accountCredit, creditApplication, feeInvoice, $queryRawUnsafe };
  const ledger = { post: jest.fn(), ensureOpeningBalance: jest.fn() };
  const audit = { write: jest.fn() };

  const service = new FinanceCreditService(
    { client } as never,
    ledger as never,
    audit as never,
  );

  const openInvoice = (outstanding: number) => ({
    id: 'inv-1',
    invoiceNumber: 'INV-2026-000001',
    status: 'issued',
    dueDate: null,
    householdId: 'hh-1',
    studentId: 'stu-1',
    lines: [{ amount: outstanding, quantity: 1 }],
    adjustments: [],
    allocations: [],
    creditApplications: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    $queryRawUnsafe.mockResolvedValue([]);
    creditApplication.create.mockImplementation(async ({ data }: any) => ({
      id: 'ca-1',
      ...data,
    }));
    feeInvoice.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      invoiceNumber: 'INV-2026-000001',
      householdId: 'hh-1',
      studentId: 'stu-1',
      ...data,
    }));
  });

  it('draws credit down oldest-first and stops at what the invoice owes', async () => {
    feeInvoice.findFirst.mockResolvedValue(openInvoice(120_000));
    accountCredit.findMany.mockResolvedValue([
      { id: 'cr-old', remaining: 100_000 },
      { id: 'cr-new', remaining: 100_000 },
    ]);
    // The candidates are locked, then re-read — so `findMany` runs twice.

    const applied = await service.autoApplyToInvoice('t1', 'inv-1', 'user-1');

    expect(applied).toBe(120_000);
    expect(creditApplication.create.mock.calls.map((c) => c[0].data)).toEqual([
      expect.objectContaining({ creditId: 'cr-old', amount: 100_000 }),
      expect.objectContaining({ creditId: 'cr-new', amount: 20_000 }),
    ]);
    // The fully-drawn credit is exhausted; the partly-drawn one stays active.
    expect(accountCredit.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 'cr-old' }, data: { remaining: 0, status: 'exhausted' } },
      { where: { id: 'cr-new' }, data: { remaining: 80_000, status: 'active' } },
    ]);
  });

  it('posts each draw-down as liability out, receivable down', async () => {
    feeInvoice.findFirst.mockResolvedValue(openInvoice(50_000));
    accountCredit.findMany.mockResolvedValue([{ id: 'cr-1', remaining: 50_000 }]);

    await service.autoApplyToInvoice('t1', 'inv-1', 'user-1');

    const posted = ledger.post.mock.calls[0][1];
    expect(posted.sourceType).toBe('credit_application');
    expect(posted.lines).toEqual([
      expect.objectContaining({ account: 'unapplied_credit', debit: 50_000 }),
      expect.objectContaining({ account: 'ar_control', credit: 50_000 }),
    ]);
  });

  it('does nothing when the family holds no credit', async () => {
    feeInvoice.findFirst.mockResolvedValue(openInvoice(50_000));
    accountCredit.findMany.mockResolvedValue([]);

    expect(await service.autoApplyToInvoice('t1', 'inv-1', 'user-1')).toBe(0);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it('leaves a draft invoice alone — credit follows an issued bill', async () => {
    feeInvoice.findFirst.mockResolvedValue({
      ...openInvoice(50_000),
      status: 'draft',
    });

    expect(await service.autoApplyToInvoice('t1', 'inv-1', 'user-1')).toBe(0);
    expect(creditApplication.create).not.toHaveBeenCalled();
  });

  it('refuses to apply more credit than the invoice still owes', async () => {
    accountCredit.findFirst.mockResolvedValue({
      id: 'cr-1',
      status: 'active',
      remaining: 500_000,
    });
    feeInvoice.findFirst.mockResolvedValue(openInvoice(50_000));

    await expect(
      service.applyCredit('t1', 'cr-1', 'inv-1', 100_000, 'user-1'),
    ).rejects.toThrow(/only has 50000 kobo outstanding/);
  });

  it('refuses to draw on an exhausted credit', async () => {
    accountCredit.findFirst.mockResolvedValue({
      id: 'cr-1',
      status: 'exhausted',
      remaining: 0,
    });

    await expect(
      service.applyCredit('t1', 'cr-1', 'inv-1', 1_000, 'user-1'),
    ).rejects.toThrow(/nothing left to draw on/);
  });

  it('will not create credit that belongs to nobody', async () => {
    await expect(
      service.createFromOverpayment(
        't1',
        { amount: 10_000, paymentId: 'rct-1' },
        'user-1',
      ),
    ).rejects.toThrow(/needs an account to sit on/);
  });
});
